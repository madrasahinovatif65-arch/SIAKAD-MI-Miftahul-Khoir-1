'use client';
import AsesmenKognitifInteraktif from '@/components/AsesmenKognitifInteraktif';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AsesmenKognitifPage() {
  const { user } = useAuth();
  const [meta, setMeta] = useState({ tahunAjaran: '', semester: '' });
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    (async () => {
      // Ambil tahun ajaran aktif dari pengaturan_sekolah
      const { data: settings } = await supabase
        .from('pengaturan_sekolah')
        .select('tahun_ajaran_aktif, semester_aktif')
        .limit(1)
        .maybeSingle();

      if (settings) {
        setMeta({ tahunAjaran: settings.tahun_ajaran_aktif, semester: settings.semester_aktif });
      }
      setLoadingMeta(false);
    })();
  }, []);

  if (!user || loadingMeta) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">🧠 Tes Kemampuan Awal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {meta.tahunAjaran} — Semester {meta.semester}
          </p>
        </div>
        <AsesmenKognitifInteraktif
          user={user}
          tahunAjaran={meta.tahunAjaran}
          semester={meta.semester}
        />
      </div>
    </div>
  );
}
