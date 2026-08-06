'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (authUserId) => {
    try {
      const { data, error } = await supabase
        .from('master_user')
        .select('*')
        .eq('user_id', authUserId)
        .eq('status_aktif', 'Aktif')
        .single();

      if (error || !data) {
        console.error('Data pengguna tidak ditemukan di master_user');
        await supabase.auth.signOut();
        return;
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
    } catch (err) {
      console.error('Error fetching user data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize session and auth state listener
  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserData(session.user.id);
      } else {
        setUser(null);
        localStorage.removeItem('siakad_user');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Login: menggunakan Supabase Auth (Email & Password)
  const login = useCallback(async (username, pin) => {
    try {
      const email = `${username.trim().toLowerCase()}@siakad.local`;
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: pin.trim(),
      });

      if (authError || !authData.user) {
        return { success: false, message: 'Kredensial tidak valid' };
      }

      // fetchUserData akan dipanggil oleh onAuthStateChange
      return { success: true };
    } catch (err) {
      return { success: false, message: 'Terjadi kesalahan: ' + err.message };
    }
  }, []);

  // Login via QR: Meminta server bypass token (karena kita tidak tahu PIN-nya)
  const loginQR = useCallback(async (username) => {
    try {
      const response = await fetch('/api/auth/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_user: username.trim() })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        return { success: false, message: data.message || 'Gagal login via QR' };
      }

      // Set session yang diterima dari server
      const { error } = await supabase.auth.setSession(data.session);
      if (error) {
         return { success: false, message: 'Gagal mengatur sesi Auth' };
      }

      // fetchUserData akan dipanggil otomatis oleh onAuthStateChange
      return { success: true };
    } catch (err) {
      return { success: false, message: 'Terjadi kesalahan jaringan: ' + err.message };
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    // state dan localStorage akan dihapus oleh onAuthStateChange
  }, []);

  const changePin = useCallback(async (oldPin, newPin) => {
    if (!user) return { success: false, message: 'Anda belum login' };

    // 1. Verifikasi PIN lama dengan mencoba update password (Supabase Auth butuh sesi aktif, tapi kita tidak bisa sekadar memvalidasi oldPassword. 
    // Sebenarnya Supabase updateUser tidak butuh oldPassword jika user sudah login.
    // Tapi untuk keamanan tambahan, kita cek ke master_user.
    const { data: check } = await supabase
      .from('master_user')
      .select('id')
      .eq('id_user', user.id_user)
      .eq('pin', oldPin)
      .single();

    if (!check) return { success: false, message: 'PIN lama tidak cocok' };

    // 2. Update password di Supabase Auth
    const { error: authError } = await supabase.auth.updateUser({ password: newPin });
    if (authError) return { success: false, message: 'Gagal update Auth: ' + authError.message };

    // 3. Update PIN di master_user (untuk referensi atau QR login bypass)
    const { error: dbError } = await supabase
      .from('master_user')
      .update({ pin: newPin })
      .eq('id_user', user.id_user);

    if (dbError) return { success: false, message: dbError.message };
    
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
