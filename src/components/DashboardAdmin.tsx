import React from 'react';
import { Student, AttendanceRecord, JournalEntry, AVAILABLE_CLASSES } from '../types';
import { Shield, Users, BookOpen, Clock, Activity, CheckCircle, HelpCircle, AlertCircle, XCircle, TrendingUp, Sparkles, Smartphone } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface DashboardAdminProps {
  students: Student[];
  records: AttendanceRecord[];
  journals: JournalEntry[];
  onNavigateToTab: (tab: string) => void;
}

export default function DashboardAdmin({ students, records, journals, onNavigateToTab }: DashboardAdminProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate active metrics
  const totalStudents = students.length;
  const totalClasses = AVAILABLE_CLASSES.length;
  const totalJournals = journals.length;

  // Calculate today's status across all students
  let presentToday = 0;
  let izinToday = 0;
  let sakitToday = 0;
  let alpaToday = 0;

  students.forEach(s => {
    const rec = records.find(r => r.date === todayStr && r.studentId === s.id);
    const status = rec ? rec.status : (s.nfcStatus === 'scanned' ? 'Hadir' : 'Alpa');
    
    if (status === 'Hadir') presentToday++;
    else if (status === 'Izin') izinToday++;
    else if (status === 'Sakit') sakitToday++;
    else if (status === 'Alpa') alpaToday++;
  });

  const overallPresenceRate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 100;

  // Chart 1: Today's status splits for Pie Chart
  const pieData = [
    { name: 'Hadir', value: presentToday, color: '#10b981' },
    { name: 'Izin', value: izinToday, color: '#3b82f6' },
    { name: 'Sakit', value: sakitToday, color: '#f59e0b' },
    { name: 'Alpa', value: alpaToday, color: '#ef4444' }
  ].filter(d => d.value > 0);

  // If no data today yet (e.g., weekend), show a seed dataset for rendering
  const finalPieData = pieData.length > 0 ? pieData : [
    { name: 'Hadir', value: 12, color: '#10b981' },
    { name: 'Izin', value: 1, color: '#3b82f6' },
    { name: 'Sakit', value: 1, color: '#f59e0b' },
    { name: 'Alpa', value: 1, color: '#ef4444' }
  ];

  // Chart 2: Daily attendance trends for the last 3 seeded days
  const dailyTrendData = [
    { tanggal: '15 Jul', Hadir: 14, Izin: 1, Sakit: 0, Alpa: 0 },
    { tanggal: '16 Jul', Hadir: 13, Izin: 1, Sakit: 1, Alpa: 0 },
    { tanggal: '17 Jul', Hadir: 13, Izin: 1, Sakit: 0, Alpa: 1 },
    { tanggal: 'Hari Ini (Est)', Hadir: presentToday, Izin: izinToday, Sakit: sakitToday, Alpa: alpaToday }
  ];

  // Calculate per-class overview
  const classBreakdowns = AVAILABLE_CLASSES.map(cls => {
    const classStuds = students.filter(s => s.classId === cls);
    let present = 0;
    
    classStuds.forEach(s => {
      const rec = records.find(r => r.date === todayStr && r.studentId === s.id);
      const status = rec ? rec.status : (s.nfcStatus === 'scanned' ? 'Hadir' : 'Alpa');
      if (status === 'Hadir') present++;
    });

    const rate = classStuds.length > 0 ? Math.round((present / classStuds.length) * 100) : 100;

    return {
      name: cls,
      total: classStuds.length,
      present,
      rate
    };
  });

  return (
    <div className="space-y-6">
      {/* Helicopter overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Terdaftar</p>
            <p className="text-3xl font-extrabold text-slate-800 font-display mt-1">{totalStudents}</p>
            <p className="text-[10px] text-emerald-600 font-medium mt-1">Siswa Aktif MI Miftahul Khoir</p>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Persentase Rata-Rata Hari Ini</p>
            <p className="text-3xl font-extrabold text-slate-800 font-display mt-1">{overallPresenceRate}%</p>
            <p className="text-[10px] text-slate-500 font-medium mt-1">Hadir: {presentToday} dari {totalStudents} murid</p>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Kelas Terpantau</p>
            <p className="text-3xl font-extrabold text-slate-800 font-display mt-1">{totalClasses}</p>
            <p className="text-[10px] text-slate-500 font-medium mt-1">Fokus di Jenjang 5 &amp; 6</p>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Jurnal Terinput</p>
            <p className="text-3xl font-extrabold text-slate-800 font-display mt-1">{totalJournals}</p>
            <p className="text-[10px] text-emerald-600 font-medium mt-1">Total Laporan Mengajar Guru</p>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Trend Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 lg:col-span-8 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800 font-display">Tren Kehadiran Harian</h3>
            <p className="text-xs text-slate-400">Menampilkan pola kehadiran siswa selama beberapa hari terakhir.</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailyTrendData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="tanggal" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Hadir" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Izin" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Sakit" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Alpa" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Breakdown Circle (Pie Chart) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 lg:col-span-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800 font-display">Proporsi Hari Ini</h3>
            <p className="text-xs text-slate-400">Rincian status absensi keseluruhan murid hari ini.</p>
          </div>

          <div className="h-44 w-full relative flex items-center justify-center my-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={finalPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {finalPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} Siswa`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <p className="text-xl font-extrabold text-slate-800 font-display">{overallPresenceRate}%</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Hadir</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600">
            <div className="flex items-center space-x-1.5 justify-center bg-slate-50 p-1.5 rounded-lg border border-slate-100/50">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Hadir: {presentToday}</span>
            </div>
            <div className="flex items-center space-x-1.5 justify-center bg-slate-50 p-1.5 rounded-lg border border-slate-100/50">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>Izin: {izinToday}</span>
            </div>
            <div className="flex items-center space-x-1.5 justify-center bg-slate-50 p-1.5 rounded-lg border border-slate-100/50">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Sakit: {sakitToday}</span>
            </div>
            <div className="flex items-center space-x-1.5 justify-center bg-slate-50 p-1.5 rounded-lg border border-slate-100/50">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span>Alpa: {alpaToday}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Class comparison & Announcements */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Class Overview comparison */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:col-span-7 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 font-display">Pantauan Kehadiran per Kelas</h3>
          
          <div className="space-y-3.5">
            {classBreakdowns.map(cls => (
              <div key={cls.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-700">{cls.name}</span>
                  <span className="text-slate-500 font-medium">
                    {cls.present} / {cls.total} Murid Hadir • <span className="font-bold text-emerald-600">{cls.rate}%</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${cls.rate}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* School announcements and notifications */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:col-span-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 font-display">Pemberitahuan Sistem &amp; Operasional</h3>
          
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 flex items-start space-x-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">NFC Card Reader Aktif</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Semua scanner NFC di gerbang utama berfungsi normal. Data tersinkronisasi dalam milidetik.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 text-slate-700 rounded-xl border border-slate-100 flex items-start space-x-2.5">
              <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Penutupan Batas Absensi Pagi</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Batas waktu pemindaian NFC mandiri pagi ini diset pada pukul 07:15 WIB. Lewat jam tersebut terhitung terlambat/alpa.</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-100 flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Koreksi Manual Guru Kelas</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Guru kelas diinstruksikan untuk selalu melakukan verifikasi silang fisik demi mendeteksi titip kartu NFC.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
