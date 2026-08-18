'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';

import Header from '@/components/layout/Header';
import NotificationProvider from '@/components/NotificationProvider';

export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-600 dark:text-white/40 text-sm">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    if (typeof window !== 'undefined') {
      router.replace('/login');
    }
    return null;
  }

  return (
    <div className="flex h-screen print:h-auto print:block bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden print:overflow-visible font-sans">
      <div className="print:hidden h-full">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 w-full relative print:block">
        <div className="print:hidden">
          <Header />
          <NotificationProvider />
        </div>
        <main className="flex-1 w-full overflow-y-auto print:overflow-visible pb-[140px] lg:pb-8 print:pb-0">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full relative z-10 print:max-w-none print:p-0">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
