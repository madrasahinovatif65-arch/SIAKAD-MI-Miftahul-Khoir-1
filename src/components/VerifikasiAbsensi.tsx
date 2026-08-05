import React, { useState } from 'react';
import { Student, AttendanceRecord, AttendanceStatus, DEFAULT_STUDENTS, AVAILABLE_CLASSES } from '../types';
import { CheckCircle, XCircle, AlertCircle, HelpCircle, Save, Calendar, Search, Filter, RefreshCw, Smartphone, Clock, Sparkles } from 'lucide-react';

interface VerifikasiAbsensiProps {
  students: Student[];
  records: AttendanceRecord[];
  onSaveRecords: (date: string, updatedRecords: { studentId: string; status: AttendanceStatus; notes?: string }[]) => Promise<void>;
  onSimulateNfcTap?: (studentId: string, time: string) => void;
  currentUser: { name: string };
}

export default function VerifikasiAbsensi({
  students,
  records,
  onSaveRecords,
  onSimulateNfcTap,
  currentUser
}: VerifikasiAbsensiProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedClass, setSelectedClass] = useState('Kelas 5A');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [editingNotes, setEditingNotes] = useState<{ [studentId: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Local working copy of statuses for the selected date to allow edit state before explicit save
  const [localStatuses, setLocalStatuses] = useState<{ [studentId: string]: AttendanceStatus }>(() => {
    const initial: { [studentId: string]: AttendanceStatus } = {};
    students.forEach(s => {
      // Find existing record
      const rec = records.find(r => r.date === selectedDate && r.studentId === s.id);
      if (rec) {
        initial[s.id] = rec.status;
      } else {
        // Fallback to NFC default: scanned -> Hadir, not_scanned -> Alpa
        initial[s.id] = s.nfcStatus === 'scanned' ? 'Hadir' : 'Alpa';
      }
    });
    return initial;
  });

  // Keep track of original notes
  const [localNotes, setLocalNotes] = useState<{ [studentId: string]: string }>(() => {
    const initial: { [studentId: string]: string } = {};
    students.forEach(s => {
      const rec = records.find(r => r.date === selectedDate && r.studentId === s.id);
      if (rec && rec.notes) {
        initial[s.id] = rec.notes;
      } else {
        initial[s.id] = '';
      }
    });
    return initial;
  });

  // Re-sync local state when date or students list change
  React.useEffect(() => {
    const initialStatuses: { [studentId: string]: AttendanceStatus } = {};
    const initialNotes: { [studentId: string]: string } = {};
    
    students.forEach(s => {
      const rec = records.find(r => r.date === selectedDate && r.studentId === s.id);
      if (rec) {
        initialStatuses[s.id] = rec.status;
        initialNotes[s.id] = rec.notes || '';
      } else {
        // Fallback to NFC default
        initialStatuses[s.id] = s.nfcStatus === 'scanned' ? 'Hadir' : 'Alpa';
        initialNotes[s.id] = '';
      }
    });
    
    setLocalStatuses(initialStatuses);
    setLocalNotes(initialNotes);
    setEditingNotes({});
    setSuccessMsg('');
  }, [selectedDate, records, students]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setLocalStatuses(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setEditingNotes(prev => ({
      ...prev,
      [studentId]: note
    }));
    setLocalNotes(prev => ({
      ...prev,
      [studentId]: note
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    try {
      const updatedList = students
        .filter(s => s.classId === selectedClass)
        .map(s => ({
          studentId: s.id,
          status: localStatuses[s.id] || 'Alpa',
          notes: localNotes[s.id] || undefined
        }));

      await onSaveRecords(selectedDate, updatedList);
      setSuccessMsg('Presensi berhasil divalidasi dan disimpan ke database!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // NFC Simulation
  const handleSimulateRandomNfc = () => {
    if (!onSimulateNfcTap) return;
    // Find students of selected class who are 'not_scanned'
    const unscanned = students.filter(s => s.classId === selectedClass && s.nfcStatus === 'not_scanned');
    if (unscanned.length === 0) {
      alert('Semua siswa di kelas ini sudah melakukan pemindaian NFC hari ini!');
      return;
    }
    const randomStudent = unscanned[Math.floor(Math.random() * unscanned.length)];
    const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    onSimulateNfcTap(randomStudent.id, timeNow);
    
    // Auto set the local status to Hadir for this student
    setLocalStatuses(prev => ({
      ...prev,
      [randomStudent.id]: 'Hadir'
    }));
  };

  // Filters
  const filteredStudents = students
    .filter(s => s.classId === selectedClass)
    .filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.nisn.includes(searchTerm);
      const studentStatus = localStatuses[s.id] || 'Alpa';
      const matchStatus = statusFilter === 'all' || studentStatus === statusFilter;
      return matchSearch && matchStatus;
    });

  // Calculate quick metrics
  const classStudents = students.filter(s => s.classId === selectedClass);
  const stats = {
    total: classStudents.length,
    present: classStudents.filter(s => localStatuses[s.id] === 'Hadir').length,
    izin: classStudents.filter(s => localStatuses[s.id] === 'Izin').length,
    sakit: classStudents.filter(s => localStatuses[s.id] === 'Sakit').length,
    alpa: classStudents.filter(s => localStatuses[s.id] === 'Alpa').length,
    nfcScanned: classStudents.filter(s => s.nfcStatus === 'scanned').length
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'Hadir':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle className="w-3.5 h-3.5 mr-1" /> Hadir</span>;
      case 'Izin':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"><HelpCircle className="w-3.5 h-3.5 mr-1" /> Izin</span>;
      case 'Sakit':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100"><AlertCircle className="w-3.5 h-3.5 mr-1" /> Sakit</span>;
      case 'Alpa':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-100"><XCircle className="w-3.5 h-3.5 mr-1" /> Alpa</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar and filter */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <input
              id="absensi-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-slate-700 text-xs font-medium focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            <select
              id="absensi-class-select"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-transparent border-none text-slate-700 text-xs font-medium focus:outline-none"
            >
              {AVAILABLE_CLASSES.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSimulateNfcTap && selectedDate === new Date().toISOString().split('T')[0] && (
            <button
              id="simulate-nfc-btn"
              onClick={handleSimulateRandomNfc}
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Simulasikan murid menempelkan kartu absen NFC pagi ini"
            >
              <Smartphone className="w-4 h-4 text-amber-600" />
              <span>Simulasi NFC Tap</span>
            </button>
          )}

          <button
            id="save-absensi-btn"
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Simpan &amp; Validasi</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div id="absensi-success-alert" className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-xs font-medium">
          {successMsg}
        </div>
      )}

      {/* Metrics widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Murid</p>
          <p className="text-2xl font-bold text-slate-800 font-display mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Hadir</p>
          <p className="text-2xl font-bold text-emerald-600 font-display mt-1">{stats.present}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Izin</p>
          <p className="text-2xl font-bold text-blue-600 font-display mt-1">{stats.izin}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Sakit</p>
          <p className="text-2xl font-bold text-amber-600 font-display mt-1">{stats.sakit}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">Alpa</p>
          <p className="text-2xl font-bold text-red-600 font-display mt-1">{stats.alpa}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center bg-gradient-to-br from-emerald-50/20 to-emerald-50/5">
          <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center justify-center">
            <Smartphone className="w-3 h-3 mr-0.5 text-emerald-600" /> NFC Scan
          </p>
          <p className="text-2xl font-bold text-emerald-800 font-display mt-1">
            {stats.nfcScanned} <span className="text-xs text-slate-400 font-normal">/ {stats.total}</span>
          </p>
        </div>
      </div>

      {/* Main Grid: Filters & Students Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Table Filter header */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              id="search-murid-input"
              type="text"
              placeholder="Cari murid berdasarkan nama atau NISN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Status Validasi:</span>
            <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
              {(['all', 'Hadir', 'Izin', 'Sakit', 'Alpa'] as const).map(f => (
                <button
                  key={f}
                  id={`status-filter-${f}-btn`}
                  onClick={() => setStatusFilter(f)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer transition-colors ${
                    statusFilter === f
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {f === 'all' ? 'Semua' : f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px] uppercase tracking-wider bg-slate-50/10">
                <th className="px-6 py-4">Nama Murid</th>
                <th className="px-6 py-4">NFC Status Mandiri</th>
                <th className="px-6 py-4 text-center">Verifikasi Kehadiran Fisik (Oleh Guru)</th>
                <th className="px-6 py-4">Catatan Guru</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 text-xs">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-400">
                    Tidak ada siswa yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const nfcLogged = student.nfcStatus === 'scanned';
                  const currentStatus = localStatuses[student.id] || 'Alpa';
                  const isAnomaly = nfcLogged && currentStatus === 'Alpa'; // NFC says checked in, but Teacher sets to Alpa

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isAnomaly ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-800">{student.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">NISN: {student.nisn}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {nfcLogged ? (
                          <div className="flex items-center space-x-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md w-max">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px] font-medium font-mono">Tapped @ {student.nfcTime}</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md w-max">
                            <Smartphone className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px] font-medium">Belum Tap NFC</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center items-center space-x-1">
                          <button
                            id={`verify-${student.id}-hadir`}
                            onClick={() => handleStatusChange(student.id, 'Hadir')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              currentStatus === 'Hadir'
                                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/10'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/50'
                            }`}
                          >
                            Hadir
                          </button>
                          <button
                            id={`verify-${student.id}-izin`}
                            onClick={() => handleStatusChange(student.id, 'Izin')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              currentStatus === 'Izin'
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/10'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/50'
                            }`}
                          >
                            Izin
                          </button>
                          <button
                            id={`verify-${student.id}-sakit`}
                            onClick={() => handleStatusChange(student.id, 'Sakit')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              currentStatus === 'Sakit'
                                ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/10'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/50'
                            }`}
                          >
                            Sakit
                          </button>
                          <button
                            id={`verify-${student.id}-alpa`}
                            onClick={() => handleStatusChange(student.id, 'Alpa')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              currentStatus === 'Alpa'
                                ? 'bg-red-600 text-white shadow-sm shadow-red-600/10'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/50'
                            }`}
                          >
                            Alpa
                          </button>
                        </div>
                        {isAnomaly && (
                          <p className="text-[9px] text-red-600 text-center font-semibold mt-1 flex items-center justify-center">
                            <AlertCircle className="w-3 h-3 mr-0.5 shrink-0" /> Terdeteksi titip absen / anomali fisik!
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <input
                          id={`note-input-${student.id}`}
                          type="text"
                          placeholder="Sakit demam, izin luar kota, dll..."
                          value={editingNotes[student.id] !== undefined ? editingNotes[student.id] : (localNotes[student.id] || '')}
                          onChange={(e) => handleNoteChange(student.id, e.target.value)}
                          className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info in validation list */}
        <div className="p-4 bg-slate-50/30 border-t border-slate-100 text-slate-400 text-[10px] flex justify-between items-center">
          <p>Guru Kelas memegang kendali penuh validasi data tanpa batas waktu edit.</p>
          <p>SIAKAD V1 MI Miftahul Khoir 1 Karangrejo</p>
        </div>
      </div>
    </div>
  );
}
