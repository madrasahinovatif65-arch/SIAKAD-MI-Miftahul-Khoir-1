import React, { useState } from 'react';
import { User, Role } from '../types';
import { Shield, BookOpen, GraduationCap, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Pre-defined accounts
    if (email === 'admin@miftahulkhoir.sch.id' && password === 'admin123') {
      onLoginSuccess({
        email,
        name: 'H. Moh. Syamsul Arifin, M.Pd.',
        role: 'admin'
      });
    } else if (email === 'guru@miftahulkhoir.sch.id' && password === 'guru123') {
      onLoginSuccess({
        email,
        name: 'Ustadz Ahmad Mudzakir, S.Pd.I.',
        role: 'guru',
        classId: 'Kelas 5A'
      });
    } else if (email === 'murid@miftahulkhoir.sch.id' && password === 'murid123') {
      onLoginSuccess({
        email,
        name: 'Ahmad Fauzi',
        role: 'murid',
        classId: 'Kelas 5A',
        studentId: 'S01'
      });
    } else {
      setError('Email atau sandi tidak sesuai. Gunakan jalan pintas di bawah jika Anda sedang melakukan peninjauan!');
    }
  };

  const handleShortcutLogin = (role: Role) => {
    if (role === 'admin') {
      setEmail('admin@miftahulkhoir.sch.id');
      setPassword('admin123');
      onLoginSuccess({
        email: 'admin@miftahulkhoir.sch.id',
        name: 'H. Moh. Syamsul Arifin, M.Pd.',
        role: 'admin'
      });
    } else if (role === 'guru') {
      setEmail('guru@miftahulkhoir.sch.id');
      setPassword('guru123');
      onLoginSuccess({
        email: 'guru@miftahulkhoir.sch.id',
        name: 'Ustadz Ahmad Mudzakir, S.Pd.I.',
        role: 'guru',
        classId: 'Kelas 5A'
      });
    } else if (role === 'murid') {
      setEmail('murid@miftahulkhoir.sch.id');
      setPassword('murid123');
      onLoginSuccess({
        email: 'murid@miftahulkhoir.sch.id',
        name: 'Ahmad Fauzi',
        role: 'murid',
        classId: 'Kelas 5A',
        studentId: 'S01'
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Decorative background gradients */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-700/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100 relative z-10"
      >
        {/* Madrasah Logo & Header */}
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <GraduationCap className="w-10 h-10" />
          </div>
          <h1 className="mt-4 text-2xl font-bold font-display text-slate-800 tracking-tight">SIAKAD V1</h1>
          <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto font-sans">
            Sistem Informasi Akademik Madrasah Inovatif
            <br />
            <span className="font-semibold text-emerald-700">MI Miftahul Khoir 1 Karangrejo</span>
          </p>
        </div>

        {/* Credentials Form */}
        <form className="mt-8 space-y-4" onSubmit={handleLogin}>
          {error && (
            <div id="login-error-msg" className="p-3 text-xs bg-red-50 text-red-700 rounded-lg border border-red-100 leading-relaxed">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Alamat Email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="login-email-input"
                type="email"
                required
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
                placeholder="ustadz@miftahulkhoir.sch.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Kata Sandi</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="login-password-input"
                type="password"
                required
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 flex items-center justify-center space-x-2 cursor-pointer mt-6"
          >
            <span>Masuk Sistem</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Role Selectors */}
        <div className="pt-6 border-t border-slate-100">
          <div className="flex items-center justify-center space-x-1.5 mb-3.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pilih Peran Peninjau (Sekali Klik)</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              id="quick-login-admin-btn"
              onClick={() => handleShortcutLogin('admin')}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-center flex flex-col items-center space-y-1.5 group transition-colors cursor-pointer"
            >
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg group-hover:bg-emerald-100 transition-colors">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-700">Admin/KS</span>
              <span className="text-[8px] text-slate-400 font-mono">admin123</span>
            </button>

            <button
              id="quick-login-guru-btn"
              onClick={() => handleShortcutLogin('guru')}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-center flex flex-col items-center space-y-1.5 group transition-colors cursor-pointer"
            >
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg group-hover:bg-emerald-100 transition-colors">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-700">Ustadz/Guru</span>
              <span className="text-[8px] text-slate-400 font-mono">guru123</span>
            </button>

            <button
              id="quick-login-murid-btn"
              onClick={() => handleShortcutLogin('murid')}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-center flex flex-col items-center space-y-1.5 group transition-colors cursor-pointer"
            >
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg group-hover:bg-emerald-100 transition-colors">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-700">Murid (Fauzi)</span>
              <span className="text-[8px] text-slate-400 font-mono">murid123</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-400">
          Sistem Informasi Akademik Madrasah Inovatif V1 © 2026
        </p>
      </motion.div>
    </div>
  );
}
