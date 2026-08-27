'use client';
import AsesmenKognitifInteraktif from '@/components/AsesmenKognitifInteraktif';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AsesmenKognitifPage() {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState({ tahunAjaran: '', semester: '' });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      setUser(profile);

      // Ambil tahun ajaran aktif
      const { data: settings } = await supabase
        .from('settings')
        .select('tahun_ajaran, semester')
        .single();

      if (settings) {
        setMeta({ tahunAjaran: settings.tahun_ajaran, semester: settings.semester });
      }
    })();
  }, []);

  if (!user) {
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
