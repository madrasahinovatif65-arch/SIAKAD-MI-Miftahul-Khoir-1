'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ProfilPage() {
  const { user, changePin, logout } = useAuth();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (newPin.length !== 6) {
      setMessage({ type: 'error', text: 'PIN baru harus 6 digit.' });
      return;
    }
    if (newPin !== confirmPin) {
      setMessage({ type: 'error', text: 'Konfirmasi PIN tidak cocok.' });
      return;
    }

    setSaving(true);
    const result = await changePin(oldPin, newPin);
    setSaving(false);

    if (result.success) {
      setMessage({ type: 'success', text: 'PIN berhasil diubah!' });
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Profil Saya</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Kelola informasi akun dan keamanan Anda</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 sm:gap-8">
        {/* Kartu Profil */}
        <div className="md:col-span-2 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-start space-y-6 shadow-sm">
          <div className="relative">
            <div className="w-32 h-32 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-5xl shadow-inner border-[4px] border-white dark:border-slate-800 overflow-hidden relative z-10">
              {user.foto ? (
                <img src={user.foto} alt="Foto Profil" className="w-full h-full object-cover" />
              ) : (
                user.nama?.charAt(0)?.toUpperCase() || '?'
              )}
            </div>
            <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 dark:opacity-30 rounded-full -z-10 transform scale-125" />
          </div>
          
          <div className="text-center w-full space-y-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate">{user.nama}</h3>
            <p className="inline-flex items-center justify-center px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-500/20">{user.role}</p>
          </div>
          
          <div className="w-full pt-6 border-t border-slate-100 dark:border-white/5 space-y-4">
            <div className="flex flex-col space-y-1 text-sm">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">ID / NISN</span>
              <span className="text-slate-800 dark:text-white font-medium bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/5">{user.id_user}</span>
            </div>
            {user.rombel && user.rombel !== '-' && (
              <div className="flex flex-col space-y-1 text-sm">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Rombel</span>
                <span className="text-slate-800 dark:text-white font-medium bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/5">{user.rombel}</span>
              </div>
            )}
            {user.mapel && user.mapel !== '-' && (
              <div className="flex flex-col space-y-1 text-sm">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Mata Pelajaran</span>
                <span className="text-slate-800 dark:text-white font-medium bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/5">{user.mapel}</span>
              </div>
            )}
          </div>
          
          {/* Tombol Logout Mobile */}
          <div className="w-full pt-6 border-t border-slate-100 dark:border-white/5 lg:hidden">
            <button 
              onClick={logout}
              className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold rounded-xl border border-rose-200 dark:border-rose-500/20 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Keluar (Logout)
            </button>
          </div>
        </div>

        {/* Form Ganti PIN */}
        <div className="md:col-span-3">
          <form onSubmit={handleSubmit} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-500/20">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Ganti PIN Keamanan</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Pastikan PIN baru mudah diingat tapi sulit ditebak.</p>
                </div>
              </div>
              
              <div className="space-y-5">
                {[
                  { label: 'PIN Lama', value: oldPin, onChange: setOldPin, placeholder: 'Masukkan 6 digit PIN saat ini', show: showOldPin, setShow: setShowOldPin },
                  { label: 'PIN Baru', value: newPin, onChange: setNewPin, placeholder: 'Masukkan 6 digit PIN baru', show: showNewPin, setShow: setShowNewPin },
                  { label: 'Konfirmasi PIN Baru', value: confirmPin, onChange: setConfirmPin, placeholder: 'Ketik ulang PIN baru', show: showConfirmPin, setShow: setShowConfirmPin },
                ].map((field, idx) => (
                  <div key={idx} className="space-y-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{field.label}</label>
                    <div className="relative">
                      <input
                        type={field.show ? 'text' : 'password'}
                        value={field.value}
                        onChange={e => field.onChange(e.target.value.replace(/\\D/g, ''))}
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder={field.placeholder}
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm tracking-[0.25em]"
                      />
                      <button
                        type="button"
                        onClick={() => field.setShow(!field.show)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                      >
                        {field.show ? (
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
                ))}
              </div>
            </div>

            {message && (
              <div className={`px-4 py-3.5 rounded-2xl text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-2 flex items-center gap-2 ${
                message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300'
              }`}>
                {message.type === 'success' ? (
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                )}
                {message.text}
              </div>
            )}

            <div className="pt-2">
              <button type="submit" disabled={saving}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2">
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Menyimpan...
                  </>
                ) : (
                  'Perbarui Keamanan'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
