'use client';

import { useState, useEffect, useRef } from 'react';

export default function CameraSelector({ onStreamReady }) {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState('');
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    // 1. Minta izin akses kamera pertama kali
    const requestPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasPermission(true);
        // Hentikan stream sementara karena kita hanya butuh izinnya untuk enumerate devices
        stream.getTracks().forEach(track => track.stop());
        
        // 2. Ambil daftar kamera
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        
        // Pilih kamera belakang (environment) jika ada, jika tidak pilih yang pertama
        const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('belakang'));
        
        if (backCamera) {
          setSelectedDeviceId(backCamera.deviceId);
        } else if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (err) {
        setError('Akses kamera ditolak atau kamera tidak ditemukan.');
        console.error(err);
      }
    };

    requestPermission();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (selectedDeviceId && hasPermission) {
      const startCamera = async () => {
        try {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          
          const constraints = {
            video: { deviceId: { exact: selectedDeviceId } }
          };
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          
          if (onStreamReady) {
            onStreamReady(stream);
          }
        } catch (err) {
          setError('Gagal memulai kamera yang dipilih.');
          console.error(err);
        }
      };
      
      startCamera();
    }
  }, [selectedDeviceId, hasPermission, onStreamReady]);

  return (
    <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
      {error && (
        <div className="p-3 bg-red-100 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      {hasPermission && devices.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Pilih Kamera
          </label>
          <select 
            className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
          >
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Kamera ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-inner">
        {!hasPermission && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
            Meminta izin kamera...
          </div>
        )}
        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
