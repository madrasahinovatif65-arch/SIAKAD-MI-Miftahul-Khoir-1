export type Role = 'admin' | 'guru' | 'murid';

export interface User {
  email: string;
  name: string;
  role: Role;
  classId?: string; // e.g. 'Kelas 5A'
  studentId?: string; // maps to a Student if role is murid
}

export interface Student {
  id: string;
  name: string;
  nisn: string;
  classId: string;
  nfcStatus: 'scanned' | 'not_scanned';
  nfcTime?: string;
}

export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  notes?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  classId: string;
  subject: string;
  topic: string;
  notes: string;
  teacherName: string;
  attendanceSummary: {
    Hadir: number;
    Izin: number;
    Sakit: number;
    Alpa: number;
  };
  studentRecords: {
    studentId: string;
    name: string;
    status: AttendanceStatus;
  }[];
  createdAt: string;
}

export interface IntegrationConfig {
  googleAppsScriptUrl: string;
  activeMode: 'local' | 'gas';
}

// Default static list of students for Madrasah Inovatif MI Miftahul Khoir 1
export const DEFAULT_STUDENTS: Student[] = [
  { id: 'S01', name: 'Ahmad Fauzi', nisn: '0123456701', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '06:45' },
  { id: 'S02', name: 'Siti Aminah', nisn: '0123456702', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '06:48' },
  { id: 'S03', name: 'Muhammad Ridho', nisn: '0123456703', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '06:50' },
  { id: 'S04', name: 'Lailatul Qadariah', nisn: '0123456704', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '06:55' },
  { id: 'S05', name: 'Muhammad Al-Fatih', nisn: '0123456705', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '06:58' },
  { id: 'S06', name: 'Fatimah Azzahra', nisn: '0123456706', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '07:02' },
  { id: 'S07', name: 'Yusuf Ibrahim', nisn: '0123456707', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '07:04' },
  { id: 'S08', name: 'Aisyah Humaira', nisn: '0123456708', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '07:12' },
  { id: 'S09', name: 'Salman Al-Farisi', nisn: '0123456709', classId: 'Kelas 5A', nfcStatus: 'not_scanned' },
  { id: 'S10', name: 'Hasan Basri', nisn: '0123456710', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '06:40' },
  { id: 'S11', name: 'Husein Ali', nisn: '0123456711', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '06:42' },
  { id: 'S12', name: 'Maryam Jamilah', nisn: '0123456712', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '06:59' },
  { id: 'S13', name: 'Bilal bin Rabah', nisn: '0123456713', classId: 'Kelas 5A', nfcStatus: 'not_scanned' },
  { id: 'S14', name: 'Khadijah Al-Kubra', nisn: '0123456714', classId: 'Kelas 5A', nfcStatus: 'scanned', nfcTime: '07:05' },
  { id: 'S15', name: 'Hamzah Abdul Muttalib', nisn: '0123456715', classId: 'Kelas 5A', nfcStatus: 'not_scanned' }
];

export const AVAILABLE_SUBJECTS = [
  'Al-Qur\'an Hadits',
  'Akidah Akhlak',
  'Fiqih',
  'Sejarah Kebudayaan Islam (SKI)',
  'Bahasa Arab',
  'Pendidikan Pancasila',
  'Bahasa Indonesia',
  'Matematika',
  'Ilmu Pengetahuan Alam & Sosial (IPAS)',
  'Seni Budaya & Prakarya'
];

export const AVAILABLE_CLASSES = [
  'Kelas 5A',
  'Kelas 5B',
  'Kelas 6A',
  'Kelas 6B'
];

// Seed sample historical attendance for some days in the past (e.g. 2026-07-15, 2026-07-16, 2026-07-17)
export const SEED_ATTENDANCE_RECORDS = (): AttendanceRecord[] => {
  const dates = ['2026-07-15', '2026-07-16', '2026-07-17'];
  const records: AttendanceRecord[] = [];

  dates.forEach(date => {
    DEFAULT_STUDENTS.forEach(student => {
      // Simulate NFC scanning logic or manual adjustments
      let status: AttendanceStatus = 'Hadir';
      
      // Some students have specific tendencies in our mock data
      if (student.id === 'S09') {
        status = date === '2026-07-16' ? 'Sakit' : 'Alpa';
      } else if (student.id === 'S13') {
        status = date === '2026-07-15' ? 'Izin' : 'Hadir';
      } else if (student.id === 'S15') {
        status = date === '2026-07-17' ? 'Izin' : 'Hadir';
      } else if (student.id === 'S08' && date === '2026-07-16') {
        status = 'Izin';
      }

      records.push({
        id: `${date}-${student.id}`,
        date,
        studentId: student.id,
        studentName: student.name,
        status,
        notes: status !== 'Hadir' ? `Absensi tanggal ${date}` : undefined,
        updatedAt: new Date(`${date}T08:00:00`).toISOString(),
        updatedBy: 'Sistem Absen NFC'
      });
    });
  });

  return records;
};

// Seed sample historical journals
export const SEED_JOURNALS = (): JournalEntry[] => {
  return [
    {
      id: 'J01',
      date: '2026-07-15',
      classId: 'Kelas 5A',
      subject: 'Al-Qur\'an Hadits',
      topic: 'Hukum Bacaan Mad Thabi\'i',
      notes: 'Siswa mempraktikkan pelafalan ayat-ayat pendek. Sebagian besar siswa (14 murid) memahami konsep panjang-pendek ketukan, 1 siswa izin (Bilal bin Rabah).',
      teacherName: 'Ustadz Ahmad Mudzakir, S.Pd.I.',
      attendanceSummary: { Hadir: 14, Izin: 1, Sakit: 0, Alpa: 0 },
      studentRecords: DEFAULT_STUDENTS.map(s => ({
        studentId: s.id,
        name: s.name,
        status: s.id === 'S13' ? 'Izin' : 'Hadir'
      })),
      createdAt: new Date('2026-07-15T10:30:00').toISOString()
    },
    {
      id: 'J02',
      date: '2026-07-16',
      classId: 'Kelas 5A',
      subject: 'Fiqih',
      topic: 'Ketentuan Shalat Berjamaah',
      notes: 'Mendemonstrasikan posisi imam dan makmum laki-laki serta perempuan di mushola sekolah. Salman Al-Farisi sakit (Demam berdarah), Aisyah Humaira izin.',
      teacherName: 'Ustadzah Siti Aminah, S.Ag.',
      attendanceSummary: { Hadir: 13, Izin: 1, Sakit: 1, Alpa: 0 },
      studentRecords: DEFAULT_STUDENTS.map(s => ({
        studentId: s.id,
        name: s.name,
        status: s.id === 'S09' ? 'Sakit' : s.id === 'S08' ? 'Izin' : 'Hadir'
      })),
      createdAt: new Date('2026-07-16T11:45:00').toISOString()
    },
    {
      id: 'J03',
      date: '2026-07-17',
      classId: 'Kelas 5A',
      subject: 'Akidah Akhlak',
      topic: 'Kisah Keteladanan Nabi Ibrahim AS',
      notes: 'Pemaparan nilai keikhlasan dan keteguhan iman Nabi Ibrahim AS. Salman Al-Farisi masih belum masuk tanpa kabar (Alpa), Hamzah Abdul Muttalib izin ada acara keluarga.',
      teacherName: 'Ustadz Muhammad Yusuf, M.Pd.',
      attendanceSummary: { Hadir: 13, Izin: 1, Sakit: 0, Alpa: 1 },
      studentRecords: DEFAULT_STUDENTS.map(s => ({
        studentId: s.id,
        name: s.name,
        status: s.id === 'S15' ? 'Izin' : s.id === 'S09' ? 'Alpa' : 'Hadir'
      })),
      createdAt: new Date('2026-07-17T09:15:00').toISOString()
    }
  ];
};
