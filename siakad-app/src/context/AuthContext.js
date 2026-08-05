'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cek session dari localStorage saat pertama kali load
  useEffect(() => {
    const savedUser = localStorage.getItem('siakad_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('siakad_user');
      }
    }
    setLoading(false);
  }, []);

  // Login: verifikasi ID_User + PIN dari tabel master_user
  const login = useCallback(async (username, pin) => {
    try {
      const { data, error } = await supabase
        .from('master_user')
        .select('*')
        .eq('id_user', username.trim())
        .eq('pin', pin.trim())
        .eq('status_aktif', 'Aktif')
        .single();

      if (error || !data) {
        return { success: false, message: 'Kredensial tidak valid' };
      }

      // Jika Murid, cari nama wali kelasnya
      let waliKelas = '-';
      if (data.role === 'Murid' && data.rombel && data.rombel !== '-') {
        const { data: waliData } = await supabase
          .from('master_user')
          .select('nama')
          .eq('role', 'Wali Kelas')
          .eq('rombel', data.rombel)
          .single();
        if (waliData) waliKelas = waliData.nama;
      }

      const userData = {
        id_user: data.id_user,
        nama: data.nama,
        role: data.role,
        rombel: data.rombel,
        status_aktif: data.status_aktif,
        mapel: data.mapel || '-',
        foto: data.foto || '',
        wali_kelas: waliKelas,
      };

      setUser(userData);
      localStorage.setItem('siakad_user', JSON.stringify(userData));
      return { success: true, data: userData };
    } catch (err) {
      return { success: false, message: 'Terjadi kesalahan: ' + err.message };
    }
  }, []);

  // Login via QR (tanpa PIN)
  const loginQR = useCallback(async (username) => {
    try {
      const { data, error } = await supabase
        .from('master_user')
        .select('*')
        .eq('id_user', username.trim())
        .eq('status_aktif', 'Aktif')
        .single();

      if (error || !data) {
        return { success: false, message: 'User tidak ditemukan' };
      }

      let waliKelas = '-';
      if (data.role === 'Murid' && data.rombel && data.rombel !== '-') {
        const { data: waliData } = await supabase
          .from('master_user')
          .select('nama')
          .eq('role', 'Wali Kelas')
          .eq('rombel', data.rombel)
          .single();
        if (waliData) waliKelas = waliData.nama;
      }

      const userData = {
        id_user: data.id_user,
        nama: data.nama,
        role: data.role,
        rombel: data.rombel,
        status_aktif: data.status_aktif,
        mapel: data.mapel || '-',
        foto: data.foto || '',
        wali_kelas: waliKelas,
      };

      setUser(userData);
      localStorage.setItem('siakad_user', JSON.stringify(userData));
      return { success: true, data: userData };
    } catch (err) {
      return { success: false, message: 'Terjadi kesalahan: ' + err.message };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('siakad_user');
    localStorage.removeItem('siakad_master_data');
  }, []);

  const changePin = useCallback(async (oldPin, newPin) => {
    if (!user) return { success: false, message: 'Anda belum login' };

    // Verifikasi PIN lama
    const { data: check } = await supabase
      .from('master_user')
      .select('id')
      .eq('id_user', user.id_user)
      .eq('pin', oldPin)
      .single();

    if (!check) return { success: false, message: 'PIN lama tidak cocok' };

    const { error } = await supabase
      .from('master_user')
      .update({ pin: newPin })
      .eq('id_user', user.id_user);

    if (error) return { success: false, message: error.message };
    return { success: true };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, loginQR, logout, changePin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
