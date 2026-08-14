'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

export default function PengaturanPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({
    tahun_ajaran: '2026/2027',
    semester: 'Ganjil',
    tgl_mulai_efektif: '2026-07-13'
  });

  const { data: pengaturan, mutate } = useSWR('pengaturan_sekolah', async () => {
    const { data, error } = await supabase.from('pengaturan_sekolah').select('*').limit(1).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  });

  useEffect(() => {
    if (user && user.role !== 'Admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (pengaturan) {
      setFormData({
        tahun_ajaran: pengaturan.tahun_ajaran || '',
        semester: pengaturan.semester || 'Ganjil',
        tgl_mulai_efektif: pengaturan.tgl_mulai_efektif || ''
      });
    }
  }, [pengaturan]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      if (pengaturan && pengaturan.id) {
        const { error } = await supabase.from('pengaturan_sekolah')
          .update(formData)
          .eq('id', pengaturan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pengaturan_sekolah')
          .insert([formData]);
        if (error) throw error;
      }
      setSuccessMsg('Pengaturan berhasil disimpan!');
      mutate();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  if (!user || (user.role !== 'Admin' && user.role !== 'Kepala Madrasah')) return null;

  const isAdmin = user.role === 'Admin';

  return (
    <div className="h-full flex flex-col space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{isAdmin ? 'Pengaturan Admin' : 'Pengaturan Sekolah'}</h2>
        <p className="text-slate-600 dark:text-white/40 text-sm mt-1">Kelola konfigurasi tahun ajaran dan periode efektif.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden max-w-2xl">
        <div className="p-6">
          <form onSubmit={handleSave} className="space-y-6">
            
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-white border-b border-slate-100 dark:border-white/10 pb-2">Tahun Ajaran Aktif</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tahun Ajaran</label>
                  <input
                    type="text"
                    name="tahun_ajaran"
                    value={formData.tahun_ajaran}
                    onChange={handleChange}
                    placeholder="Contoh: 2026/2027"
                    disabled={!isAdmin}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${!isAdmin ? 'opacity-80' : ''}`}
                    required
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Semester</label>
                  <select
                    name="semester"
                    value={formData.semester}
                    onChange={handleChange}
                    disabled={!isAdmin}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${!isAdmin ? 'opacity-80' : ''}`}
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal Mulai Efektif (Awal Masuk)</label>
                <input
                  type="date"
                  name="tgl_mulai_efektif"
                  value={formData.tgl_mulai_efektif}
                  onChange={handleChange}
                  disabled={!isAdmin}
                  className={`w-full md:w-1/2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${!isAdmin ? 'opacity-80' : ''}`}
                  required
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tanggal ini digunakan sebagai acuan awal perhitungan persentase kartu ringkasan untuk absensi guru bulan pertama.</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm">
                {errorMsg}
              </div>
            )}
            
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm">
                {successMsg}
              </div>
            )}

            {isAdmin && (
              <div className="pt-4 flex justify-end border-t border-slate-100 dark:border-white/5">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
