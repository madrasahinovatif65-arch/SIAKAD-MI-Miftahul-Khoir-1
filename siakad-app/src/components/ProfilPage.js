'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ProfilPage() {
  const { user, changePin } = useAuth();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Profil Saya</h2>
        <p className="text-white/40 text-sm mt-1">Informasi akun dan keamanan</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kartu Profil */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4 shadow-xl">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-lg shadow-blue-500/20 ring-4 ring-white/10 overflow-hidden">
            {user.foto ? (
              <img src={user.foto} alt="Foto Profil" className="w-full h-full object-cover" />
            ) : (
              user.nama?.charAt(0)?.toUpperCase() || '?'
            )}
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold text-white">{user.nama}</h3>
            <p className="text-blue-400 font-medium">{user.role}</p>
          </div>
          <div className="w-full pt-4 border-t border-white/10 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/40">ID / NISN</span>
              <span className="text-white font-medium">{user.id_user}</span>
            </div>
            {user.rombel && user.rombel !== '-' && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/40">Rombel</span>
                <span className="text-white font-medium">{user.rombel}</span>
              </div>
            )}
            {user.mapel && user.mapel !== '-' && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/40">Mata Pelajaran</span>
                <span className="text-white font-medium">{user.mapel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Form Ganti PIN */}
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-5 shadow-xl">
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Ganti PIN Keamanan</h3>
            
            <div className="space-y-4">
              {[
                { label: 'PIN Lama', value: oldPin, onChange: setOldPin },
                { label: 'PIN Baru (6 digit)', value: newPin, onChange: setNewPin },
                { label: 'Konfirmasi PIN Baru', value: confirmPin, onChange: setConfirmPin },
              ].map((field, idx) => (
                <div key={idx} className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider font-medium">{field.label}</label>
                  <input
                    type="password"
                    value={field.value}
                    onChange={e => field.onChange(e.target.value)}
                    maxLength={6}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-400/50 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>

          {message && (
            <div className={`px-4 py-3 rounded-xl text-sm ${
              message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'
            }`}>{message.text}</div>
          )}

          <button type="submit" disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Ubah PIN'}
          </button>
        </form>
      </div>
    </div>
  );
}
