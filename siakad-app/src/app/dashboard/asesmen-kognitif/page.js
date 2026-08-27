'use client';
import AsesmenKognitifInteraktif from '@/components/AsesmenKognitifInteraktif';
import AsesmenNKInteraktif from '@/components/AsesmenNKInteraktif';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AsesmenKognitifPage() {
  const { user } = useAuth();
  const [meta, setMeta] = useState({ tahunAjaran: '', semester: '' });
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [activeTab, setActiveTab] = useState('kognitif');

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
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">🧠 Asesmen Diagnostik</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {meta.tahunAjaran} — Semester {meta.semester}
          </p>
        </div>

        {/* Tab Navigasi */}
        <div className="flex gap-1 p-1 bg-white/50 dark:bg-slate-800/50 backdrop-blur border border-slate-200 dark:border-white/10 rounded-xl mb-6">
          <button
            onClick={() => setActiveTab('kognitif')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'kognitif'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Kognitif Umum
          </button>
          <button
            onClick={() => setActiveTab('non-kognitif')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'non-kognitif'
                ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Non-Kognitif
          </button>
        </div>

        {activeTab === 'kognitif' && (
          <AsesmenKognitifInteraktif
            user={user}
            tahunAjaran={meta.tahunAjaran}
            semester={meta.semester}
          />
        )}

        {activeTab === 'non-kognitif' && (
          <AsesmenNKInteraktif
            user={user}
            tahunAjaran={meta.tahunAjaran}
          />
        )}
      </div>
    </div>
  );
}
