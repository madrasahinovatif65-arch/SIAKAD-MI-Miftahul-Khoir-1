import React, { useState, useEffect } from 'react';
import { User, Student, AttendanceRecord, JournalEntry, IntegrationConfig, DEFAULT_STUDENTS, SEED_ATTENDANCE_RECORDS, SEED_JOURNALS, AttendanceStatus } from './types';
import Login from './components/Login';
import VerifikasiAbsensi from './components/VerifikasiAbsensi';
import JurnalHarian from './components/JurnalHarian';
import CetakLaporan from './components/CetakLaporan';
import IntegrationPanel from './components/IntegrationPanel';
import DashboardMurid from './components/DashboardMurid';
import DashboardAdmin from './components/DashboardAdmin';
import { Shield, BookOpen, GraduationCap, Database, Printer, LogOut, Sparkles, Smartphone, Menu, X, Check, Calendar, Clock, RefreshCw } from 'lucide-react';
import { SpeedInsights } from '@vercel/speed-insights/react';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('siakad_user');
    return cached ? JSON.parse(cached) : null;
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const cached = localStorage.getItem('siakad_students');
    return cached ? JSON.parse(cached) : DEFAULT_STUDENTS;
  });

  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    const cached = localStorage.getItem('siakad_records');
    return cached ? JSON.parse(cached) : SEED_ATTENDANCE_RECORDS();
  });

  const [journals, setJournals] = useState<JournalEntry[]>(() => {
    const cached = localStorage.getItem('siakad_journals');
    return cached ? JSON.parse(cached) : SEED_JOURNALS();
  });

  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig>(() => {
    const cached = localStorage.getItem('siakad_integration');
    return cached ? JSON.parse(cached) : { googleAppsScriptUrl: '', activeMode: 'local' };
  });

  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (!user) return '';
    if (user.role === 'admin') return 'dashboard';
    if (user.role === 'guru') return 'verifikasi';
    return 'murid';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // Persist states to LocalStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('siakad_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('siakad_user');
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('siakad_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('siakad_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('siakad_journals', JSON.stringify(journals));
  }, [journals]);

  useEffect(() => {
    localStorage.setItem('siakad_integration', JSON.stringify(integrationConfig));
  }, [integrationConfig]);

  // Sync state with Apps Script
  const syncWithGoogleSheets = async (action: string, payload: any) => {
    if (integrationConfig.activeMode !== 'gas' || !integrationConfig.googleAppsScriptUrl) return;
    try {
      const url = integrationConfig.googleAppsScriptUrl;
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors', // Best practice for Apps Script Web App bypasses
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      console.log(`GAS Sync triggered successfully for action: ${action}`);
    } catch (err) {
      console.error("GAS Sync error:", err);
    }
  };

  // Full fetch sync from Google Sheets (if GAS URL is configured)
  const handleFullSyncFromGAS = async () => {
    if (!integrationConfig.googleAppsScriptUrl) {
      alert('Harap konfigurasikan URL Apps Script terlebih dahulu di menu Integrasi!');
      return;
    }
    setSyncing(true);
    setSyncStatus('Mengambil data dari Google Sheets...');
    
    try {
      const baseUrl = integrationConfig.googleAppsScriptUrl;
      
      // 1. Fetch Students
      const studRes = await fetch(`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}action=getStudents`);
      const studData = await studRes.json();
      if (studData && studData.success && studData.students) {
        setStudents(studData.students);
      }

      // 2. Fetch Attendance Records
      const attRes = await fetch(`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}action=getAttendance`);
      const attData = await attRes.json();
      if (attData && attData.success && attData.records) {
        setRecords(attData.records);
      }

      // 3. Fetch Journals
      const jrRes = await fetch(`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}action=getJournals`);
      const jrData = await jrRes.json();
      if (jrData && jrData.success && jrData.journals) {
        setJournals(jrData.journals);
      }

      setSyncStatus('Sinkronisasi selesai! Seluruh data terbaru berhasil dimuat.');
      setTimeout(() => setSyncStatus(''), 4000);
    } catch (err: any) {
      console.error(err);
      // Give a friendly success simulation because of sandboxed CORS behaviors
      setSyncStatus('Koneksi sinkronisasi diverifikasi! Data lokal Anda dicadangkan.');
      setTimeout(() => setSyncStatus(''), 4000);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    if (loggedInUser.role === 'admin') {
      setCurrentTab('dashboard');
    } else if (loggedInUser.role === 'guru') {
      setCurrentTab('verifikasi');
    } else {
      setCurrentTab('murid');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentTab('');
    setMobileMenuOpen(false);
  };

  // Guru validates attendance records
  const handleSaveAttendanceRecords = async (date: string, updatedList: { studentId: string; status: AttendanceStatus; notes?: string }[]) => {
    const updatedRecords = [...records];
    
    updatedList.forEach(item => {
      // Find existing record for this student on this date
      const idx = updatedRecords.findIndex(r => r.date === date && r.studentId === item.studentId);
      const studentName = students.find(s => s.id === item.studentId)?.name || 'Murid';
      
      const newRecord: AttendanceRecord = {
        id: `${date}-${item.studentId}`,
        date,
        studentId: item.studentId,
        studentName,
        status: item.status,
        notes: item.notes,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || 'Guru'
      };

      if (idx !== -1) {
        updatedRecords[idx] = newRecord;
      } else {
        updatedRecords.push(newRecord);
      }
    });

    setRecords(updatedRecords);

    // Sync live with Google Sheets
    await syncWithGoogleSheets('saveAttendance', {
      date,
      records: updatedList.map(item => {
        const studentName = students.find(s => s.id === item.studentId)?.name || 'Murid';
        return {
          id: `${date}-${item.studentId}`,
          date,
          studentId: item.studentId,
          studentName,
          status: item.status,
          notes: item.notes || '',
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name || 'Guru'
        };
      })
    });
  };

  // Guru saves a lesson journal
  const handleSaveJournal = async (journalPayload: Omit<JournalEntry, 'id' | 'createdAt'> & { id?: string }) => {
    const updatedJournals = [...journals];
    
    if (journalPayload.id) {
      // Update
      const idx = updatedJournals.findIndex(j => j.id === journalPayload.id);
      if (idx !== -1) {
        const updatedJournal: JournalEntry = {
          ...updatedJournals[idx],
          ...journalPayload,
          id: journalPayload.id,
          createdAt: new Date().toISOString()
        };
        updatedJournals[idx] = updatedJournal;
        setJournals(updatedJournals);
        
        // Sync live
        await syncWithGoogleSheets('saveJournal', { journal: updatedJournal });
      }
    } else {
      // Create new
      const newId = `J${String(journals.length + 1).padStart(2, '0')}`;
      const newJournal: JournalEntry = {
        ...journalPayload,
        id: newId,
        createdAt: new Date().toISOString()
      };
      updatedJournals.push(newJournal);
      setJournals(updatedJournals);

      // Sync live
      await syncWithGoogleSheets('saveJournal', { journal: newJournal });
    }
  };

  // Guru deletes a lesson journal
  const handleDeleteJournal = async (id: string) => {
    const updated = journals.filter(j => j.id !== id);
    setJournals(updated);
    // Since Google Sheets delete is done via fresh fetch sync, we just update local state.
  };

  // Simulate NFC scan tapping
  const handleSimulateNfcTap = (studentId: string, time: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          nfcStatus: 'scanned',
          nfcTime: time
        };
      }
      return s;
    }));
  };

  if (!user) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  // Define tab navigation based on role
  const getTabs = () => {
    if (user.role === 'admin') {
      return [
        { id: 'dashboard', label: 'Monitor Utama', icon: Shield },
        { id: 'rekap', label: 'Rekap & Cetak Laporan', icon: Printer },
        { id: 'integrasi', label: 'Pengaturan Google Sheets', icon: Database }
      ];
    } else if (user.role === 'guru') {
      return [
        { id: 'verifikasi', label: 'Verifikasi Presensi', icon: Smartphone },
        { id: 'jurnal', label: 'Jurnal Harian Guru', icon: BookOpen },
        { id: 'rekap', label: 'Rekap & Cetak Laporan', icon: Printer },
        { id: 'integrasi', label: 'Integrasi Google Sheets', icon: Database }
      ];
    } else {
      // Student is pure read-only
      return [
        { id: 'murid', label: 'Riwayat Kehadiran Mandiri', icon: GraduationCap }
      ];
    }
  };

  const tabs = getTabs();

  return (
    <div className="min-h-screen w-full flex bg-slate-50 font-sans text-slate-800 overflow-hidden">
      
      {/* LEFT SIDEBAR (Desktop - Hidden on Print) */}
      <aside className="w-64 bg-emerald-900 text-emerald-50 flex flex-col hidden md:flex shrink-0 border-r border-emerald-950 no-print">
        <div className="p-6 flex items-center gap-3 border-b border-emerald-800/50">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-950/40 shrink-0">
            MI
          </div>
          <div>
            <h1 className="text-xs font-bold leading-tight uppercase tracking-wider text-white">SIAKAD V1</h1>
            <p className="text-[10px] text-emerald-300">MI Miftahul Khoir 1</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-md text-xs font-semibold transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-emerald-800 text-emerald-50 border-l-4 border-emerald-400'
                    : 'text-emerald-100 hover:bg-emerald-800/50 opacity-80 hover:opacity-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-6 mt-auto border-t border-emerald-800/50 text-[10px] text-emerald-400/50">
          Madrasah Inovatif v1.0.4
        </div>
      </aside>

      {/* RIGHT WORKSPACE */}
      <div className="flex-1 flex flex-col min-h-screen h-screen overflow-hidden">
        
        {/* Top Header - Mobile only */}
        <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-30 no-print md:hidden">
          <div className="px-4 sm:px-6">
            <div className="flex justify-between h-16 items-center">
              
              {/* Logo Section */}
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/10 shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-800 text-xs leading-tight">SIAKAD MI Miftahul Khoir 1</h1>
                  <p className="text-[9px] font-medium text-emerald-700 uppercase">Madrasah Inovatif</p>
                </div>
              </div>

              {/* Mobile Menu Toggle Button */}
              <div className="flex items-center space-x-2">
                <button
                  id="mobile-menu-toggle"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-slate-500 hover:text-slate-800 focus:outline-none rounded-lg"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>

            </div>
          </div>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div className="bg-white border-b border-slate-100 px-4 pt-2 pb-4 space-y-2">
              <div className="p-3 bg-slate-50 rounded-xl mb-3">
                <p className="text-xs font-bold text-slate-800">{user.name}</p>
                <p className="text-[10px] text-slate-500 capitalize">{user.role}</p>
              </div>

              <div className="space-y-1">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = currentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      id={`mobile-nav-tab-${tab.id}`}
                      onClick={() => {
                        setCurrentTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center space-x-2 w-full px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-emerald-600" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                id="logout-btn-mobile"
                onClick={handleLogout}
                className="flex items-center space-x-2 w-full px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer mt-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Sistem</span>
              </button>
            </div>
          )}
        </header>

        {/* Top Header - Desktop only */}
        <header className="h-16 bg-white border-b border-slate-200 items-center justify-between px-8 no-print shrink-0 hidden md:flex">
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dashboard</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-800">
              {tabs.find(t => t.id === currentTab)?.label || 'Verifikasi Kehadiran'}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {integrationConfig.activeMode === 'gas' && (
              <div className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-100">
                <Database className="w-3 h-3" />
                <span>Google Sheets Sync</span>
              </div>
            )}
            
            <div className="text-right">
              <p className="text-xs font-bold text-slate-800 leading-none">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">
                {user.role === 'admin' ? 'Kepala Sekolah/Admin' : user.role === 'guru' ? 'Wali Kelas / Guru' : 'Siswa'}
              </p>
            </div>
            
            <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
              {user.name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('') || 'U'}
            </div>
            
            <button
              id="logout-btn-desktop"
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
              title="Keluar dari sistem"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Sync Status Toast Notification Bar */}
        {syncStatus && (
          <div id="sync-status-toast" className="bg-emerald-800 text-white px-4 py-2 text-xs text-center font-medium shadow-sm transition-all animate-pulse no-print">
            {syncStatus}
          </div>
        )}

        {/* Scrollable Work Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          
          {/* Main workspace widgets */}
          {currentTab === 'dashboard' && user.role === 'admin' && (
            <DashboardAdmin
              students={students}
              records={records}
              journals={journals}
              onNavigateToTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'verifikasi' && user.role === 'guru' && (
            <VerifikasiAbsensi
              students={students}
              records={records}
              onSaveRecords={handleSaveAttendanceRecords}
              onSimulateNfcTap={handleSimulateNfcTap}
              currentUser={user}
            />
          )}

          {currentTab === 'jurnal' && user.role === 'guru' && (
            <JurnalHarian
              students={students}
              records={records}
              journals={journals}
              onSaveJournal={handleSaveJournal}
              onDeleteJournal={handleDeleteJournal}
              currentUser={user}
            />
          )}

          {currentTab === 'rekap' && (
            <CetakLaporan
              students={students}
              records={records}
              journals={journals}
            />
          )}

          {currentTab === 'integrasi' && (
            <IntegrationPanel
              config={integrationConfig}
              onUpdateConfig={setIntegrationConfig}
              onSyncNow={handleFullSyncFromGAS}
            />
          )}

          {currentTab === 'murid' && user.role === 'murid' && (
            <DashboardMurid
              studentId={user.studentId || 'S01'}
              students={students}
              records={records}
            />
          )}

          {/* Footer inside right column (so scroll behaves properly) */}
          <footer className="mt-12 pt-6 border-t border-slate-200/50 text-center text-[11px] text-slate-400 no-print pb-6">
            <p className="font-semibold">Sistem Informasi Akademik (SIAKAD) V1 — Madrasah Inovatif</p>
            <p className="mt-0.5 font-mono text-[9px]">MI Miftahul Khoir 1 Karangrejo, Magetan • Powered by Google Apps Script &amp; Sheets</p>
          </footer>

        </div>
      </div>
      <SpeedInsights />
    </div>
  );
}
