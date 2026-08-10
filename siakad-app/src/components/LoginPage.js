'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage({ onLoginSuccess }) {
  const { login, loginQR } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  useEffect(() => {
    // Inject HTML5 QR Code script if not present
    if (!document.getElementById('html5-qrcode-script')) {
      const script = document.createElement('script');
      script.id = 'html5-qrcode-script';
      script.src = 'https://unpkg.com/html5-qrcode';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const scannerRef = useRef(null);

  const handleScan = () => {
    if (!window.Html5Qrcode) {
      setError("Library scanner sedang dimuat, coba klik beberapa detik lagi.");
      return;
    }
    setShowScanner(true);
    setError('');

    // Meminta izin dan mendapatkan daftar kamera terlebih dahulu
    window.Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) {
        setCameras(devices);
        
        // Cari kamera belakang sebagai prioritas
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('belakang'));
        const defaultCameraId = backCamera ? backCamera.id : devices[0].id;
        setSelectedCameraId(defaultCameraId);
        
        startScannerWithCamera(defaultCameraId);
      } else {
        setError("Tidak ada kamera yang ditemukan di perangkat ini.");
        setShowScanner(false);
      }
    }).catch(err => {
      setError("Kamera gagal diakses. Pastikan izin kamera diberikan.");
      setShowScanner(false);
    });
  };

  const startScannerWithCamera = (cameraId) => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(e => console.error(e)).finally(() => {
        scannerRef.current.clear();
        scannerRef.current = null;
        startNewScanner(cameraId);
      });
    } else {
      startNewScanner(cameraId);
    }
  };

  const startNewScanner = (cameraId) => {
    const html5QrCode = new window.Html5Qrcode("qr-reader");
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      cameraId,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        if (scannerRef.current) {
          scannerRef.current.stop().catch(e => console.error(e)).finally(() => {
            scannerRef.current.clear();
            scannerRef.current = null;
          });
        }
        setShowScanner(false);
        setIsLoading(true);
        setError('');
        
        setUsername(decodedText);
        const result = await loginQR(decodedText);
        setIsLoading(false);

        if (result.success) {
          onLoginSuccess?.(result.data);
        } else {
          setError(result.message);
        }
      },
      (err) => {
        // ignore scan errors
      }
    ).catch(err => {
      setError("Kamera gagal diakses. Pastikan izin kamera diberikan.");
      setShowScanner(false);
    });
  };

  const handleCancelScan = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(e => console.error(e)).finally(() => {
        scannerRef.current.clear();
        scannerRef.current = null;
      });
    }
    setShowScanner(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(username, pin);
    setIsLoading(false);

    if (result.success) {
      onLoginSuccess?.(result.data);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 dark:from-slate-900 dark:via-[#0a1f1c] dark:to-slate-900 relative overflow-hidden transition-colors duration-500">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl -top-48 -left-48 animate-pulse" />
        <div className="absolute w-80 h-80 bg-teal-500/10 dark:bg-white/5 rounded-full blur-3xl -bottom-40 -right-40 animate-pulse delay-1000" />
        <div className="absolute w-64 h-64 bg-emerald-500/10 dark:bg-teal-500/5 rounded-full blur-3xl top-1/2 left-1/3 animate-pulse delay-500" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Glass Card */}
        <div className="backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-3xl shadow-2xl p-8 space-y-8">
          
          {/* Logo / Brand */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-24 h-24 flex items-center justify-center drop-shadow-[0_0_15px_rgba(52,211,148,0.5)] transform hover:scale-105 transition-transform">
              <img src="/logo.png" alt="Logo Inovatif+" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Inovatif+
            </h1>
            <p className="text-sm text-emerald-700/90 dark:text-teal-200/60">
              Madrasah Inovatif - MI Miftahul Khoir 1 Karangrejo
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 text-red-600 dark:text-red-300 text-sm text-center animate-shake">
              {error}
            </div>
          )}

          {/* Scanner UI */}
          <div className={`space-y-4 ${showScanner ? 'block' : 'hidden'}`}>
            {cameras.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-emerald-700 dark:text-teal-200/70 uppercase tracking-wider">
                  Pilih Kamera
                </label>
                <select 
                  className="w-full px-4 py-2.5 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition-all"
                  value={selectedCameraId}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    startScannerWithCamera(e.target.value);
                  }}
                >
                  {cameras.map((cam, idx) => (
                    <option key={cam.id} value={cam.id} className="text-slate-900">
                      {cam.label || `Kamera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div id="qr-reader" className="w-full overflow-hidden rounded-xl border-2 border-slate-300 dark:border-white/20 bg-black/50"></div>
            <button 
              onClick={handleCancelScan}
              className="w-full py-2.5 bg-white dark:bg-white/10 hover:bg-white dark:bg-white/20 text-slate-900 dark:text-white font-medium rounded-xl transition-colors">
              Batal Scan
            </button>
          </div>

          {/* Login Form UI */}
          <div className={showScanner ? 'hidden' : 'block'}>
            <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium text-emerald-700 dark:text-teal-200/70 uppercase tracking-wider">
                ID User / NISN
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan ID User"
                required
                className="w-full px-4 py-3.5 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-teal-500 dark:focus:border-teal-400/50 focus:bg-white/80 dark:focus:bg-white/8 focus:ring-2 focus:ring-teal-500/30 dark:focus:ring-teal-400/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-emerald-700 dark:text-teal-200/70 uppercase tracking-wider">
                PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Masukkan PIN 6 digit"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  className="w-full px-4 py-3.5 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-teal-500 dark:focus:border-teal-400/50 focus:bg-white/80 dark:focus:bg-white/8 focus:ring-2 focus:ring-teal-500/30 dark:focus:ring-teal-400/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-teal-200/50 hover:text-teal-200/80 transition-colors"
                >
                  {showPin ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-slate-900 dark:text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memverifikasi...
                </span>
              ) : (
                'Masuk'
              )}
            </button>
            </form>
              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-slate-300 dark:border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-slate-600 dark:text-white/30 text-xs font-medium uppercase tracking-wider">ATAU</span>
                <div className="flex-grow border-t border-slate-300 dark:border-white/10"></div>
              </div>

              <button
                type="button"
                onClick={handleScan}
                disabled={isLoading}
                className="w-full py-3.5 bg-white/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 hover:bg-white dark:bg-white/10 text-slate-900 dark:text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
                </svg>
                Scan QR Code Kartu
              </button>
            </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-400 dark:text-white/20">
            Versi 2.0 · Powered by Minova
          </p>
        </div>
      </div>
    </div>
  );
}
