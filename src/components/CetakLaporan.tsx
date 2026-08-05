import React, { useState } from 'react';
import { Student, AttendanceRecord, JournalEntry, AVAILABLE_CLASSES } from '../types';
import { Printer, Calendar, FileText, Filter, Table, CheckSquare, Layers, Award } from 'lucide-react';

interface CetakLaporanProps {
  students: Student[];
  records: AttendanceRecord[];
  journals: JournalEntry[];
}

export default function CetakLaporan({ students, records, journals }: CetakLaporanProps) {
  const [startDate, setStartDate] = useState(() => {
    // Default to start of current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedClass, setSelectedClass] = useState('Kelas 5A');

  // Filter students
  const classStudents = students.filter(s => s.classId === selectedClass);

  // Get distinct dates in range
  const getDatesInRange = (start: string, end: string) => {
    const arr = [];
    const dt = new Date(start);
    const endDt = new Date(end);
    while (dt <= endDt) {
      arr.push(new Date(dt).toISOString().split('T')[0]);
      dt.setDate(dt.getDate() + 1);
    }
    return arr;
  };

  const datesList = getDatesInRange(startDate, endDate);

  // Filtered records in range for selected class
  const classRecordsInRange = records.filter(r => 
    r.date >= startDate && 
    r.date <= endDate && 
    classStudents.some(s => s.id === r.studentId)
  );

  // Filtered journals in range
  const classJournalsInRange = journals.filter(j => 
    j.date >= startDate && 
    j.date <= endDate && 
    j.classId === selectedClass
  );

  // Calculate metrics per student
  const studentStats = classStudents.map(student => {
    const studentRecs = classRecordsInRange.filter(r => r.studentId === student.id);
    
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alpa = 0;

    // To make sure we count days correctly, let's iterate through the dates we have actual records for in the range
    // Or just calculate from studentRecs
    studentRecs.forEach(r => {
      if (r.status === 'Hadir') hadir++;
      else if (r.status === 'Izin') izin++;
      else if (r.status === 'Sakit') sakit++;
      else if (r.status === 'Alpa') alpa++;
    });

    const totalDays = hadir + izin + sakit + alpa;
    const presencePercentage = totalDays > 0 ? Math.round((hadir / totalDays) * 100) : 100;

    return {
      student,
      hadir,
      izin,
      sakit,
      alpa,
      totalDays,
      presencePercentage
    };
  });

  const handlePrint = () => {
    window.print();
  };

  // Format date in Indonesian
  const formatDateIndo = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Filter Panel (Hidden during print) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            <select
              id="report-class-select"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-transparent border-none text-slate-700 text-xs font-semibold focus:outline-none"
            >
              {AVAILABLE_CLASSES.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Dari:</span>
            <input
              id="report-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-slate-700 text-xs font-medium focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Hingga:</span>
            <input
              id="report-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-slate-700 text-xs font-medium focus:outline-none"
            />
          </div>
        </div>

        <button
          id="print-report-btn"
          onClick={handlePrint}
          className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg flex items-center space-x-1.5 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Laporan</span>
        </button>
      </div>

      {/* Screen Preview Card (Styled beautifully for Screen) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 print-card">
        {/* PRINT LETTERHEAD (Always visible in print, hidden/optional in normal web screen, but we will make it beautifully visible as a professional preview!) */}
        <div className="border-b-4 border-double border-slate-800 pb-5 mb-6 text-center">
          <div className="flex justify-center items-center space-x-4">
            <div className="w-16 h-16 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0">
              <Award className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-slate-800 tracking-wide uppercase">YAYASAN MI MIFTAHUL KHOIR 1</h1>
              <h2 className="text-lg font-bold text-emerald-700 uppercase">MADRASAH IBTIDAIYAH (MI) MIFTAHUL KHOIR 1</h2>
              <p className="text-[10px] text-slate-500 font-mono italic">
                NPSN: 60721245 | Akreditasi: A | Jl. Karangrejo No. 12, Karangrejo, Kec. Karangrejo, Magetan
              </p>
            </div>
          </div>
        </div>

        {/* Report Meta Info */}
        <div className="text-center mb-6">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            LAPORAN REKAPITULASI AKADEMIK &amp; PRESENSI BULANAN
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Periode: <span className="font-semibold text-slate-700">{formatDateIndo(startDate)}</span> s.d. <span className="font-semibold text-slate-700">{formatDateIndo(endDate)}</span>
          </p>
          <p className="text-xs text-slate-500">
            Kelas / Rombel: <span className="font-semibold text-emerald-800">{selectedClass}</span>
          </p>
        </div>

        {/* Section 1: Attendance Table */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2 no-print">
            <Table className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">1. Rekapitulasi Kehadiran Siswa</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border border-slate-200 print-table text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="px-4 py-3 border-r border-slate-200 w-12 text-center">No</th>
                  <th className="px-4 py-3 border-r border-slate-200">Nama Murid</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-center w-24">NISN</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-center text-emerald-600 w-20">Hadir</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-center text-blue-600 w-20">Izin</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-center text-amber-600 w-20">Sakit</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-center text-red-600 w-20">Alpa</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-center w-28">Total Hari Efektif</th>
                  <th className="px-4 py-3 text-center font-bold bg-slate-100 w-24">Persentase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {studentStats.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-slate-400 italic">
                      Tidak ada data siswa untuk kelas ini.
                    </td>
                  </tr>
                ) : (
                  studentStats.map((stat, idx) => (
                    <tr key={stat.student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                      <td className="px-4 py-2.5 border-r border-slate-200 font-medium text-slate-800">{stat.student.name}</td>
                      <td className="px-4 py-2.5 border-r border-slate-200 text-center font-mono">{stat.student.nisn}</td>
                      <td className="px-4 py-2.5 border-r border-slate-200 text-center font-semibold text-emerald-700">{stat.hadir}</td>
                      <td className="px-4 py-2.5 border-r border-slate-200 text-center text-blue-700">{stat.izin}</td>
                      <td className="px-4 py-2.5 border-r border-slate-200 text-center text-amber-700">{stat.sakit}</td>
                      <td className="px-4 py-2.5 border-r border-slate-200 text-center text-red-700">{stat.alpa}</td>
                      <td className="px-4 py-2.5 border-r border-slate-200 text-center font-mono">{stat.totalDays}</td>
                      <td className={`px-4 py-2.5 text-center font-bold ${
                        stat.presencePercentage >= 90 ? 'text-emerald-700 bg-emerald-50/20' : 
                        stat.presencePercentage >= 75 ? 'text-amber-700 bg-amber-50/20' : 'text-red-700 bg-red-50/20'
                      }`}>
                        {stat.presencePercentage}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Journals Table (Includes page break before if long) */}
        <div className="space-y-3 page-break">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2 no-print">
            <FileText className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">2. Rekapitulasi Jurnal Pembelajaran Guru</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border border-slate-200 print-table text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="px-4 py-3 border-r border-slate-200 w-12 text-center">No</th>
                  <th className="px-4 py-3 border-r border-slate-200 w-28 text-center">Tanggal</th>
                  <th className="px-4 py-3 border-r border-slate-200 w-44">Mata Pelajaran</th>
                  <th className="px-4 py-3 border-r border-slate-200">Materi Pembelajaran</th>
                  <th className="px-4 py-3 border-r border-slate-200 w-44">Catatan Harian</th>
                  <th className="px-4 py-3 text-center w-36">Rekap Kehadiran Hari</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {classJournalsInRange.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                      Tidak ada catatan jurnal mengajar pada rentang tanggal ini.
                    </td>
                  </tr>
                ) : (
                  classJournalsInRange
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((j, idx) => (
                      <tr key={j.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 border-r border-slate-200 text-center font-medium">{formatDateIndo(j.date)}</td>
                        <td className="px-4 py-2.5 border-r border-slate-200 font-semibold text-slate-800">{j.subject}</td>
                        <td className="px-4 py-2.5 border-r border-slate-200">{j.topic}</td>
                        <td className="px-4 py-2.5 border-r border-slate-200 italic text-slate-500">"{j.notes || '-'}"</td>
                        <td className="px-4 py-2.5 text-center text-[11px] font-mono font-medium">
                          H: {j.attendanceSummary.Hadir} | I: {j.attendanceSummary.Izin} | S: {j.attendanceSummary.Sakit} | A: {j.attendanceSummary.Alpa}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Print Sign-off block (Khas instansi sekolah Indonesia) */}
        <div className="mt-12 grid grid-cols-2 text-center text-xs text-slate-800 font-sans">
          <div>
            <p className="text-slate-400 uppercase tracking-wide no-print">Disiapkan Oleh,</p>
            <p className="font-semibold text-slate-700 uppercase tracking-wide print-only">Guru Kelas / Wali Kelas,</p>
            <div className="h-20"></div>
            <p className="font-bold underline text-slate-900">{classJournalsInRange[0]?.teacherName || 'Ustadz Ahmad Mudzakir, S.Pd.I.'}</p>
            <p className="text-slate-400 font-mono text-[10px]">NIP. 19851120 201212 1 002</p>
          </div>

          <div>
            <p className="text-slate-400 uppercase tracking-wide no-print">Mengetahui Kepala Madrasah,</p>
            <p className="font-semibold text-slate-700 uppercase tracking-wide print-only">Mengetahui,<br />Kepala Madrasah Ibtidaiyah,</p>
            <div className="h-20"></div>
            <p className="font-bold underline text-slate-900">H. Moh. Syamsul Arifin, M.Pd.</p>
            <p className="text-slate-400 font-mono text-[10px]">NIP. 19740512 200312 1 001</p>
          </div>
        </div>
      </div>
    </div>
  );
}
