import React from 'react';
import { Student, AttendanceRecord, AttendanceStatus } from '../types';
import { Calendar, User, BookOpen, Clock, CheckCircle, HelpCircle, AlertCircle, XCircle, Award, Sparkles, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardMuridProps {
  studentId: string;
  students: Student[];
  records: AttendanceRecord[];
}

export default function DashboardMurid({ studentId, students, records }: DashboardMuridProps) {
  const student = students.find(s => s.id === studentId);
  if (!student) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 rounded-xl">
        Profil siswa tidak ditemukan dalam sistem!
      </div>
    );
  }

  // Get historical records for this student
  const studentRecords = records.filter(r => r.studentId === student.id);

  // Calculate metrics
  let hadir = 0;
  let izin = 0;
  let sakit = 0;
  let alpa = 0;

  studentRecords.forEach(r => {
    if (r.status === 'Hadir') hadir++;
    else if (r.status === 'Izin') izin++;
    else if (r.status === 'Sakit') sakit++;
    else if (r.status === 'Alpa') alpa++;
  });

  // Calculate current date's status from NFC
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = studentRecords.find(r => r.date === todayStr);
  const currentStatus: AttendanceStatus = todayRecord ? todayRecord.status : (student.nfcStatus === 'scanned' ? 'Hadir' : 'Alpa');

  const totalDays = hadir + izin + sakit + alpa;
  const presencePercentage = totalDays > 0 ? Math.round((hadir / totalDays) * 100) : 100;

  // Islamic quote for student motivation
  const islamicQuotes = [
    "\"Barang siapa menempuh jalan untuk mencari ilmu, maka Allah akan memudahkan jalannya menuju Surga.\" (HR. Muslim)",
    "\"Menuntut ilmu adalah kewajiban bagi setiap muslim.\" (HR. Ibnu Majah)",
    "\"Ilmu itu bagaikan binatang buruan, dan tulisan adalah pengikatnya. Maka ikatlah buruanmu dengan tali yang kuat.\" - Imam Syafi'i",
  ];
  const quote = islamicQuotes[new Date().getDate() % islamicQuotes.length];

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'Hadir':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle className="w-3 h-3 mr-1" /> Hadir</span>;
      case 'Izin':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100"><HelpCircle className="w-3 h-3 mr-1" /> Izin</span>;
      case 'Sakit':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100"><AlertCircle className="w-3 h-3 mr-1" /> Sakit</span>;
      case 'Alpa':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-100"><XCircle className="w-3 h-3 mr-1" /> Alpa</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome card with Islamic motivation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white rounded-2xl shadow-lg p-6 relative overflow-hidden"
      >
        <div className="absolute right-0 bottom-0 translate-x-1/6 translate-y-1/6 opacity-10">
          <Award className="w-64 h-64" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-1.5 bg-emerald-700/50 w-max px-2.5 py-1 rounded-full text-xs font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Assalamu'alaikum Warahmatullahi Wabarakatuh</span>
            </div>
            <h2 className="text-2xl font-bold font-display tracking-tight">Ahlan Wa Sahlan, {student.name}!</h2>
            <p className="text-emerald-100 text-xs italic max-w-xl font-sans mt-2">
              {quote}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 shrink-0 text-center w-full md:w-auto">
            <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">Persentase Kehadiran</p>
            <p className="text-3xl font-extrabold font-display text-white mt-1">{presencePercentage}%</p>
            <p className="text-[9px] text-emerald-200 mt-0.5 font-sans">Pertahankan prestasi dan disiplinmu!</p>
          </div>
        </div>
      </motion.div>

      {/* Profile & Current NFC status details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center">
            <User className="w-4 h-4 mr-1 text-emerald-600" /> Profil Murid
          </h3>

          <div className="space-y-3 text-xs text-slate-600">
            <div>
              <p className="text-slate-400">Nama Lengkap</p>
              <p className="font-semibold text-slate-800 text-sm mt-0.5">{student.name}</p>
            </div>
            <div>
              <p className="text-slate-400">Nomor Induk Siswa Nasional (NISN)</p>
              <p className="font-semibold text-slate-800 font-mono text-sm mt-0.5">{student.nisn}</p>
            </div>
            <div>
              <p className="text-slate-400">Kelas / Rombongan Belajar</p>
              <p className="font-semibold text-emerald-800 text-sm mt-0.5">{student.classId}</p>
            </div>
            <div>
              <p className="text-slate-400">Sekolah</p>
              <p className="font-semibold text-slate-800 mt-0.5">MI Miftahul Khoir 1 Karangrejo</p>
            </div>
          </div>
        </div>

        {/* Current Day NFC Scan Detail */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center">
            <Clock className="w-4 h-4 mr-1 text-emerald-600" /> Status Kehadiran Hari Ini
          </h3>

          <div className="flex flex-col items-center justify-center py-4 space-y-3 text-center">
            {student.nfcStatus === 'scanned' ? (
              <>
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-800 text-sm">Sudah Terpindai NFC</h4>
                  <p className="text-[11px] text-slate-500 mt-1">Kartu absen mandiri Anda terbaca pada pukul:</p>
                  <p className="text-lg font-bold font-mono text-slate-800 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1 mt-1 w-max mx-auto">
                    {student.nfcTime} WIB
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 bg-rose-50 text-rose-600 rounded-full">
                  <XCircle className="w-10 h-10 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-rose-800 text-sm">Belum Memindai NFC</h4>
                  <p className="text-[11px] text-slate-500 mt-1">Silakan tap kartu absen Anda pada pemindai NFC di lobi gerbang Madrasah.</p>
                </div>
              </>
            )}

            <div className="pt-2 border-t border-slate-100 w-full text-center">
              <p className="text-[10px] text-slate-400">Verifikasi Guru Kelas saat ini:</p>
              <div className="mt-1">{getStatusBadge(currentStatus)}</div>
            </div>
          </div>
        </div>

        {/* Dynamic attendance counters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center">
            <BookOpen className="w-4 h-4 mr-1 text-emerald-600" /> Akumulasi Kehadiran
          </h3>

          <div className="grid grid-cols-2 gap-3 text-center py-2">
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-50">
              <p className="text-[9px] font-bold text-emerald-700 uppercase">Hadir</p>
              <p className="text-2xl font-extrabold text-emerald-800 font-display mt-0.5">{hadir}</p>
            </div>
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-50">
              <p className="text-[9px] font-bold text-blue-700 uppercase">Izin</p>
              <p className="text-2xl font-extrabold text-blue-800 font-display mt-0.5">{izin}</p>
            </div>
            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-50">
              <p className="text-[9px] font-bold text-amber-700 uppercase">Sakit</p>
              <p className="text-2xl font-extrabold text-amber-800 font-display mt-0.5">{sakit}</p>
            </div>
            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-50">
              <p className="text-[9px] font-bold text-rose-700 uppercase">Alpa</p>
              <p className="text-2xl font-extrabold text-rose-800 font-display mt-0.5">{alpa}</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 text-center">
            Total rekapitulasi hari aktif: <span className="font-semibold text-slate-700">{totalDays} hari</span>
          </p>
        </div>
      </div>

      {/* History log list */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-800 font-display mb-4">Riwayat Log Absensi Lengkap</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px] uppercase tracking-wider bg-slate-50/30">
                <th className="px-6 py-3">Tanggal Absensi</th>
                <th className="px-6 py-3">Status Verifikasi</th>
                <th className="px-6 py-3">Pencatat / Guru Pembina</th>
                <th className="px-6 py-3">Keterangan / Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {studentRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-400 italic">
                    Belum ada riwayat tercatat dalam sistem.
                  </td>
                </tr>
              ) : (
                studentRecords
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3.5 font-medium">{rec.date}</td>
                      <td className="px-6 py-3.5">{getStatusBadge(rec.status)}</td>
                      <td className="px-6 py-3.5 text-slate-500 font-medium">{rec.updatedBy}</td>
                      <td className="px-6 py-3.5 italic text-slate-400">
                        {rec.notes ? `"${rec.notes}"` : '-'}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
