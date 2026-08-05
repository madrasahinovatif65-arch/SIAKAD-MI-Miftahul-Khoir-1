import React, { useState } from 'react';
import { Student, AttendanceRecord, JournalEntry, AVAILABLE_SUBJECTS, AVAILABLE_CLASSES, AttendanceStatus } from '../types';
import { BookOpen, Calendar, Users, FileText, Check, Plus, Trash2, Edit3, ArrowRight, Book, Activity, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface JurnalHarianProps {
  students: Student[];
  records: AttendanceRecord[];
  journals: JournalEntry[];
  onSaveJournal: (journal: Omit<JournalEntry, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  onDeleteJournal: (id: string) => Promise<void>;
  currentUser: { name: string };
}

export default function JurnalHarian({
  students,
  records,
  journals,
  onSaveJournal,
  onDeleteJournal,
  currentUser
}: JurnalHarianProps) {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [classId, setClassId] = useState('Kelas 5A');
  const [subject, setSubject] = useState(AVAILABLE_SUBJECTS[0]);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Calculate snapshot of attendance for selected date and class
  const classStudents = students.filter(s => s.classId === classId);
  const classRecords = records.filter(r => r.date === date && classStudents.some(s => s.id === r.studentId));

  const stats = {
    Hadir: 0,
    Izin: 0,
    Sakit: 0,
    Alpa: 0
  };

  classStudents.forEach(s => {
    const rec = classRecords.find(r => r.studentId === s.id);
    if (rec) {
      stats[rec.status]++;
    } else {
      // Default to NFC state
      if (s.nfcStatus === 'scanned') {
        stats.Hadir++;
      } else {
        stats.Alpa++;
      }
    }
  });

  const handleEdit = (journal: JournalEntry) => {
    setEditingId(journal.id);
    setDate(journal.date);
    setClassId(journal.classId);
    setSubject(journal.subject);
    setTopic(journal.topic);
    setNotes(journal.notes);
    
    // Scroll to form
    const formElement = document.getElementById('journal-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTopic('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      alert('Harap isi materi pembelajaran!');
      return;
    }

    setSaving(true);
    setSuccessMsg('');

    try {
      // Build snapshot of student status list
      const snapshotRecords = classStudents.map(s => {
        const rec = classRecords.find(r => r.studentId === s.id);
        const status: AttendanceStatus = rec ? rec.status : (s.nfcStatus === 'scanned' ? 'Hadir' : 'Alpa');
        return {
          studentId: s.id,
          name: s.name,
          status
        };
      });

      const journalPayload = {
        id: editingId || undefined,
        date,
        classId,
        subject,
        topic,
        notes,
        teacherName: currentUser.name,
        attendanceSummary: { ...stats },
        studentRecords: snapshotRecords
      };

      await onSaveJournal(journalPayload);

      setSuccessMsg(editingId ? 'Jurnal harian berhasil diperbarui!' : 'Jurnal harian mengajar berhasil disimpan ke database!');
      setTimeout(() => setSuccessMsg(''), 4000);

      // Reset
      setEditingId(null);
      setTopic('');
      setNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus jurnal harian mengajar ini?')) {
      try {
        await onDeleteJournal(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Filter existing journals
  const filteredJournals = journals.filter(j => {
    const matchSearch = j.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        j.topic.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        j.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        j.classId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Journal Entry Form */}
      <div id="journal-form" className="lg:col-span-5 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 font-display">
                {editingId ? 'Edit Jurnal Harian Mengajar' : 'Input Jurnal Harian Guru'}
              </h2>
              <p className="text-xs text-slate-500">Mendigitalkan proses belajar mengajar sekaligus merekap kehadiran kelas harian secara terpadu.</p>
            </div>
          </div>

          {successMsg && (
            <div id="journal-success-alert" className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-xs font-medium mb-4">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Tanggal
                </label>
                <input
                  id="journal-date-input"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-xs px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Kelas
                </label>
                <select
                  id="journal-class-select"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="block w-full border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-xs px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                >
                  {AVAILABLE_CLASSES.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center">
                <Book className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Mata Pelajaran
              </label>
              <select
                id="journal-subject-select"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="block w-full border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-xs px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              >
                {AVAILABLE_SUBJECTS.map(subj => (
                  <option key={subj} value={subj}>{subj}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Materi / Topik Pembelajaran</label>
              <input
                id="journal-topic-input"
                type="text"
                required
                placeholder="Contoh: Ketentuan Wudhu & Praktik Bersuci"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="block w-full border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-xs px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Catatan Khusus / Hasil Pembelajaran</label>
              <textarea
                id="journal-notes-textarea"
                rows={4}
                placeholder="Catat kondisi kelas, anak yang memerlukan bimbingan khusus, atau pencapaian belajar hari ini..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-xs px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all resize-none"
              ></textarea>
            </div>

            {/* Attendance Snapshot Widget - Live Preview */}
            <div className="bg-emerald-50/40 rounded-xl p-4 border border-emerald-100/50 space-y-3">
              <p className="text-[11px] font-bold text-emerald-800 flex items-center uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 mr-1" /> Snapshot Kehadiran Tersemat ({classId})
              </p>
              
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <p className="text-[9px] font-medium text-slate-400">Hadir</p>
                  <p className="text-sm font-bold text-emerald-600">{stats.Hadir}</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <p className="text-[9px] font-medium text-slate-400">Izin</p>
                  <p className="text-sm font-bold text-blue-600">{stats.Izin}</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <p className="text-[9px] font-medium text-slate-400">Sakit</p>
                  <p className="text-sm font-bold text-amber-600">{stats.Sakit}</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                  <p className="text-[9px] font-medium text-slate-400">Alpa</p>
                  <p className="text-sm font-bold text-red-600">{stats.Alpa}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                Data presensi di atas akan disimpan permanen menyatu dengan jurnal pembelajaran ini. Pastikan Anda sudah memvalidasi presensi hari ini.
              </p>
            </div>

            <div className="flex space-x-2">
              {editingId && (
                <button
                  id="cancel-edit-journal-btn"
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-3 rounded-xl transition-all cursor-pointer text-center"
                >
                  Batal
                </button>
              )}
              <button
                id="submit-journal-btn"
                type="submit"
                disabled={saving}
                className="flex-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : editingId ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>{editingId ? 'Simpan Perubahan' : 'Simpan Jurnal & Rekap'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Historical Journals List */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-semibold text-slate-800 font-display">Riwayat Jurnal Mengajar</h3>
              <p className="text-xs text-slate-500">Daftar rekaman mengajar guru yang telah tersimpan dalam sistem database.</p>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                id="search-journal-input"
                type="text"
                placeholder="Cari materi / mapel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 bg-slate-50/50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin pr-1">
            {filteredJournals.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-100 rounded-xl">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Belum ada catatan jurnal mengajar yang sesuai.</p>
              </div>
            ) : (
              filteredJournals
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(j => (
                  <motion.div
                    key={j.id}
                    layoutId={`journal-card-${j.id}`}
                    className="p-5 border border-slate-100 rounded-xl hover:border-emerald-100 hover:bg-emerald-50/5 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {j.classId}
                        </span>
                        <h4 className="font-bold text-slate-800 text-sm mt-1">{j.subject}</h4>
                        <p className="text-[11px] text-slate-500 flex items-center">
                          <Calendar className="w-3 h-3 mr-1" /> {j.date} | Oleh {j.teacherName}
                        </p>
                      </div>

                      <div className="flex space-x-1">
                        <button
                          id={`edit-journal-btn-${j.id}`}
                          onClick={() => handleEdit(j)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Edit jurnal ini"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          id={`delete-journal-btn-${j.id}`}
                          onClick={() => handleDelete(j.id)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Hapus jurnal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 border-t border-slate-50 pt-2.5">
                      <p><span className="font-semibold text-slate-800">Materi:</span> {j.topic}</p>
                      {j.notes && (
                        <p className="italic text-[11px] text-slate-500 bg-slate-50/50 p-2 rounded-lg border border-slate-100 mt-1">
                          "{j.notes}"
                        </p>
                      )}
                    </div>

                    {/* Compact attached attendance snapshot */}
                    <div className="flex items-center space-x-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-700">Snapshot Kehadiran:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-emerald-700 font-medium">Hadir: {j.attendanceSummary.Hadir}</span>
                        <span>•</span>
                        <span className="text-blue-700 font-medium">Izin: {j.attendanceSummary.Izin}</span>
                        <span>•</span>
                        <span className="text-amber-700 font-medium">Sakit: {j.attendanceSummary.Sakit}</span>
                        <span>•</span>
                        <span className="text-red-700 font-medium">Alpa: {j.attendanceSummary.Alpa}</span>
                      </div>
                    </div>
                  </motion.div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
