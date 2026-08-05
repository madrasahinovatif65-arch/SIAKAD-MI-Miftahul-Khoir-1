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
    
    // Inisialisasi secara sinkron dengan klik untuk memastikan izin kamera diminta
    const html5QrCode = new window.Html5Qrcode("qr-reader");
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      { facingMode: "environment" },
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 relative overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -top-48 -left-48 animate-pulse" />
        <div className="absolute w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -bottom-40 -right-40 animate-pulse delay-1000" />
        <div className="absolute w-64 h-64 bg-cyan-500/8 rounded-full blur-3xl top-1/2 left-1/3 animate-pulse delay-500" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Glass Card */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl p-8 space-y-8">
          
          {/* Logo / Brand */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 transform hover:scale-105 transition-transform overflow-hidden p-2">
              <img src="/logo.png" alt="Logo SIAKAD" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              SIAKAD
            </h1>
            <p className="text-sm text-blue-200/60">
              MI Miftahul Khoir — Sistem Informasi Akademik
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm text-center animate-shake">
              {error}
            </div>
          )}

          {/* Scanner UI */}
          <div className={`space-y-4 ${showScanner ? 'block' : 'hidden'}`}>
            <div id="qr-reader" className="w-full overflow-hidden rounded-xl border-2 border-white/20 bg-black/50"></div>
            <button 
              onClick={handleCancelScan}
              className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors">
              Batal Scan
            </button>
          </div>

          {/* Login Form UI */}
          <div className={showScanner ? 'hidden' : 'block'}>
            <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium text-blue-200/70 uppercase tracking-wider">
                ID User / NISN
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan ID User"
                required
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-400/50 focus:bg-white/8 focus:ring-2 focus:ring-blue-400/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-blue-200/70 uppercase tracking-wider">
                PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Masukkan PIN 6 digit"
                maxLength={6}
                required
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-400/50 focus:bg-white/8 focus:ring-2 focus:ring-blue-400/20 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
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
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-white/30 text-xs font-medium uppercase tracking-wider">ATAU</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              <button
                type="button"
                onClick={handleScan}
                disabled={isLoading}
                className="w-full py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
                </svg>
                Scan QR Code Kartu
              </button>
            </div>

          {/* Footer */}
          <p className="text-center text-xs text-white/20">
            Versi 2.0 · Powered by Supabase
          </p>
        </div>
      </div>
    </div>
  );
}
