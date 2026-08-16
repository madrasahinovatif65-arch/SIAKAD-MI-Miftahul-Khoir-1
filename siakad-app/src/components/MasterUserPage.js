'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import imageCompression from 'browser-image-compression';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/lib/cropImage';

export default function MasterUserPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('Semua');
  const [filterRombel, setFilterRombel] = useState('Semua');

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Editing RFID
  const [editingRfidId, setEditingRfidId] = useState(null);
  const [rfidInput, setRfidInput] = useState('');
  const rfidInputRef = useRef(null);

  // Bulk Actions State
  const [showMoveRombel, setShowMoveRombel] = useState(false);
  const [newRombel, setNewRombel] = useState('');

  // Admin Edit Photo State
  const [editingPhotoUser, setEditingPhotoUser] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const fileInputRef = useRef(null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Fetch Data
  // Fetch Data using SWR
  const { data: usersData, error: swrError, isLoading: loading, mutate } = useSWR((user?.role === 'Admin' || user?.role === 'Kepala Madrasah') ? 'master_user' : null, async () => {
    const { data, error } = await supabase.from('master_user').select('*').order('role').order('nama');
    if (error) throw error;
    return data || [];
  });

  const users = usersData || [];
  
  useEffect(() => {
    if (swrError) setMessage({ type: 'error', text: 'Gagal memuat data: ' + swrError.message });
  }, [swrError]);

  const rombelOptions = users.length > 0 ? [...new Set(users.map(d => d.rombel).filter(r => r && r !== '-'))].sort() : [];

  useEffect(() => {
    if (user && user.role !== 'Admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  if (user?.role !== 'Admin') {
    return <div className="p-8 text-center text-red-500">Akses ditolak.</div>;
  }

  // Handle Scan / RFID Edit
  const handleRfidClick = (id, currentRfid) => {
    setEditingRfidId(id);
    setRfidInput(currentRfid || '');
    setTimeout(() => {
      if (rfidInputRef.current) rfidInputRef.current.focus();
    }, 100);
  };

  const saveRfid = async (id, rfidValue) => {
    const val = rfidValue.trim();
    // Validate uniqueness locally first to be friendly
    if (val) {
      const duplicate = users.find(u => u.id !== id && u.rfid === val);
      if (duplicate) {
        setMessage({ type: 'error', text: `RFID ${val} sudah dipakai oleh ${duplicate.nama}` });
        setEditingRfidId(null);
        return;
      }
    }

    const { error } = await supabase
      .from('master_user')
      .update({ rfid: val || null })
      .eq('id', id);

    if (error) {
      setMessage({ type: 'error', text: 'Gagal update RFID: ' + error.message });
    } else {
      mutate(users.map(u => u.id === id ? { ...u, rfid: val || null } : u), false);
      setMessage({ type: 'success', text: 'RFID berhasil diperbarui!' });
    }
    setEditingRfidId(null);
  };

  const handleRfidKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRfid(id, rfidInput);
    } else if (e.key === 'Escape') {
      setEditingRfidId(null);
    }
  };

  // Bulk Actions
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredUsers.map(u => u.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Yakin ingin menghapus ${selectedIds.length} pengguna terpilih? Aksi ini permanen!`)) return;
    setLoading(true);
    const { error } = await supabase.from('master_user').delete().in('id', selectedIds);
    if (error) {
      setMessage({ type: 'error', text: 'Gagal menghapus: ' + error.message });
    } else {
      setMessage({ type: 'success', text: `${selectedIds.length} pengguna berhasil dihapus.` });
      setSelectedIds([]);
      mutate();
    }
    setLoading(false);
  };

  const handleBulkMoveRombel = async () => {
    if (!newRombel) return;
    if (!window.confirm(`Pindahkan ${selectedIds.length} pengguna ke rombel ${newRombel}?`)) return;
    setLoading(true);
    const { error } = await supabase.from('master_user').update({ rombel: newRombel }).in('id', selectedIds);
    if (error) {
      setMessage({ type: 'error', text: 'Gagal pindah rombel: ' + error.message });
    } else {
      setMessage({ type: 'success', text: `${selectedIds.length} pengguna berhasil dipindah ke ${newRombel}.` });
      setShowMoveRombel(false);
      setNewRombel('');
      setSelectedIds([]);
      mutate();
    }
    setLoading(false);
  };

  // Photo Upload & Crop Handlers
  const handleAvatarClick = (targetUser) => {
    setEditingPhotoUser(targetUser);
    if (targetUser.foto) {
      setShowPreviewModal(true);
    } else {
      // Langsung buka galeri jika tidak ada foto
      fileInputRef.current?.click();
    }
  };

  const handleEditCurrentPhoto = () => {
    setImageSrc(editingPhotoUser.foto);
    setShowPreviewModal(false);
    setShowCropModal(true);
  };

  const handlePhotoSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result);
        setShowPreviewModal(false);
        setShowCropModal(true);
      });
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleDownloadPhoto = async (url, userName) => {
    try {
      setMessage({ type: 'success', text: 'Mengunduh foto...' });
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Foto_NFC_${userName}.webp`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      setMessage(null);
    } catch (error) {
      console.error('Gagal mengunduh foto', error);
      setMessage({ type: 'error', text: 'Gagal mengunduh foto.' });
    }
  };

  const handleCropCancel = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setShowCropModal(false);
    setEditingPhotoUser(null);
  };

  const handleUploadCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels || !editingPhotoUser) return;

    try {
      setUploadingPhoto(true);
      setMessage(null);
      
      const croppedImageFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      setShowCropModal(false);
      setImageSrc(null);

      const options = { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(croppedImageFile, options);

      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${editingPhotoUser.id_user}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profil_app')
        .upload(fileName, compressedFile, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('profil_app').getPublicUrl(fileName);
      const newUrl = publicUrlData.publicUrl;

      // Update db: Admin hanya mengubah kolom foto (untuk NFC)
      const { error: updateError } = await supabase
        .from('master_user')
        .update({ foto: newUrl })
        .eq('id', editingPhotoUser.id);

      if (updateError) throw updateError;

      mutate();
      setMessage({ type: 'success', text: `Foto profil ${editingPhotoUser.nama} berhasil diperbarui!` });
    } catch (err) {
      console.error('Error upload:', err);
      setMessage({ type: 'error', text: 'Gagal mengunggah foto: ' + err.message });
      setShowCropModal(false);
      setImageSrc(null);
    } finally {
      setUploadingPhoto(false);
      setEditingPhotoUser(null);
    }
  };

  // Excel Upload/Download
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'ID_User': '1234567890', 'Nama': 'Siswa Contoh', 'Role': 'Murid', 'PIN': '123456', 'Rombel': '1A', 'Status': 'Aktif', 'Mapel': '-', 'Link Foto': '', 'RFID': '' },
      { 'ID_User': 'NIP001', 'Nama': 'Guru Contoh', 'Role': 'Guru Mapel', 'PIN': '654321', 'Rombel': '-', 'Status': 'Aktif', 'Mapel': 'Matematika', 'Link Foto': '', 'RFID': '' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Pengguna");
    XLSX.writeFile(wb, "Template_Master_Pengguna.xlsx");
  };

  const exportData = () => {
    const exportedArray = filteredUsers.map(u => ({
      'ID_User': u.id_user,
      'Nama': u.nama,
      'Role': u.role,
      'PIN': u.pin || '',
      'Rombel': u.rombel,
      'Status': u.status_aktif,
      'Mapel': u.mapel || '-',
      'Link Foto': u.foto || '',
      'RFID': u.rfid || ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportedArray);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data_Pengguna");
    XLSX.writeFile(wb, "Export_Master_Pengguna.xlsx");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) throw new Error("File kosong");

        // Format to match DB schema
        const toUpsert = data.map(d => ({
          id_user: String(d.ID_User || d.id_user || ''),
          nama: String(d.Nama || d.nama || ''),
          role: String(d.Role || d.role || 'Murid'),
          pin: d.PIN !== undefined ? String(d.PIN) : (d.pin !== undefined ? String(d.pin) : null),
          rombel: String(d.Rombel || d.rombel || '-'),
          status_aktif: String(d.Status || d.status_aktif || 'Aktif'),
          mapel: String(d.Mapel || d.mapel || '-'),
          foto: d['Link Foto'] || d.foto || null,
          rfid: d.RFID || d.rfid || null
        })).filter(d => d.id_user && d.nama); // minimal required fields

        if (toUpsert.length === 0) throw new Error("Format tidak sesuai, pastikan kolom id_user dan nama terisi.");

        const { error } = await supabase.from('master_user').upsert(toUpsert, { onConflict: 'id_user' });
        if (error) throw error;

        setMessage({ type: 'success', text: `Berhasil mengimpor ${toUpsert.length} data pengguna.` });
        mutate();
      } catch (err) {
        setMessage({ type: 'error', text: 'Gagal impor: ' + err.message });
      }
      setLoading(false);
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset input
  };

  // Filter Data
  const filteredUsers = users.filter(u => {
    const matchSearch = u.nama.toLowerCase().includes(searchQuery.toLowerCase()) || String(u.id_user).includes(searchQuery);
    const matchRole = filterRole === 'Semua' || u.role === filterRole;
    const matchRombel = filterRombel === 'Semua' || u.rombel === filterRombel;
    return matchSearch && matchRole && matchRombel;
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Data Pengguna</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{user?.role === 'Admin' ? 'Manajemen Master User, Impor Excel, & Registrasi RFID' : 'Daftar Pengguna SIAKAD'}</p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'Admin' && (
            <button onClick={downloadTemplate} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors">
              Unduh Template
            </button>
          )}
          <button onClick={exportData} className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 rounded-xl text-sm font-semibold transition-colors">
            Export Excel
          </button>
          {user?.role === 'Admin' && (
            <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold cursor-pointer shadow-sm transition-colors">
              Import Excel
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
            </label>
          )}
        </div>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium shadow-sm flex items-center justify-between ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
          }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Cari</label>
            <input
              type="text"
              placeholder="Nama atau ID/NISN..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Role</label>
            <div className="relative">
              <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                style={{ backgroundImage: 'none' }}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-white focus:outline-none focus:border-emerald-500">
                <option value="Semua">Semua Role</option>
                <option value="Murid">Murid</option>
                <option value="Guru Mapel">Guru Mapel</option>
                <option value="Wali Kelas">Wali Kelas</option>
                <option value="Admin">Admin</option>
              </select>
              <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Rombel</label>
            <div className="relative">
              <select value={filterRombel} onChange={e => setFilterRombel(e.target.value)}
                style={{ backgroundImage: 'none' }}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-white focus:outline-none focus:border-emerald-500">
                <option value="Semua">Semua Rombel</option>
                {rombelOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {user?.role === 'Admin' && selectedIds.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="text-blue-700 dark:text-blue-300 font-medium text-sm">
            <span className="font-bold">{selectedIds.length}</span> pengguna terpilih
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {!showMoveRombel ? (
              <>
                <button onClick={() => setShowMoveRombel(true)} className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors">
                  Pindah Rombel
                </button>
                <button onClick={handleBulkDelete} className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold transition-colors">
                  Hapus
                </button>
              </>
            ) : (
              <div className="flex w-full sm:w-auto gap-2 items-center">
                <input type="text" placeholder="Nama Rombel Baru..." value={newRombel} onChange={e => setNewRombel(e.target.value)} className="w-full sm:w-48 px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 focus:outline-none" />
                <button onClick={handleBulkMoveRombel} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold">Simpan</button>
                <button onClick={() => setShowMoveRombel(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold">Batal</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                {user?.role === 'Admin' && (
                  <th className="px-4 py-4 w-12 text-center">
                    <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === filteredUsers.length && filteredUsers.length > 0} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  </th>
                )}
                <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID / NISN</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Lengkap</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Info Akademik</th>
                <th className="px-5 py-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50/50 dark:bg-emerald-500/5">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>
                    RFID UID
                  </span>
                </th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Tidak ada data ditemukan.</td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className={`transition-colors group ${selectedIds.includes(u.id) ? 'bg-emerald-50/50 dark:bg-emerald-500/10' : 'hover:bg-slate-50/50 dark:hover:bg-white/5'}`}>
                    {user?.role === 'Admin' && (
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => handleSelect(u.id)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      </td>
                    )}
                    <td className="px-5 py-3 text-sm text-slate-400 dark:text-slate-500 font-mono">{u.id_user}</td>
                    <td className="px-5 py-3 text-sm text-slate-800 dark:text-white font-semibold">
                      <div className="flex items-center gap-3">
                        <div className="relative group/avatar cursor-pointer shrink-0" onClick={() => user?.role === 'Admin' && handleAvatarClick(u)}>
                          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-500 font-bold">
                            {u.foto ? (
                              <img src={u.foto} alt="Avatar NFC" className="w-full h-full object-cover" />
                            ) : (
                              u.nama.charAt(0).toUpperCase()
                            )}
                          </div>
                          {user?.role === 'Admin' && (
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>
                            </div>
                          )}
                        </div>
                        <span className="truncate max-w-[150px] sm:max-w-[200px]" title={u.nama}>{u.nama}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 max-w-[200px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs font-semibold">{u.role}</span>
                        {u.rombel && u.rombel !== '-' && <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-xs font-bold">{u.rombel}</span>}
                        {u.mapel && u.mapel !== '-' && <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded text-xs font-bold">{u.mapel}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 bg-emerald-50/30 dark:bg-emerald-500/5 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/10 transition-colors w-56">
                      {editingRfidId === u.id && user?.role === 'Admin' ? (
                        <input
                          ref={rfidInputRef}
                          type="text"
                          value={rfidInput}
                          onChange={e => setRfidInput(e.target.value)}
                          onKeyDown={e => handleRfidKeyDown(e, u.id)}
                          onBlur={() => saveRfid(u.id, rfidInput)}
                          placeholder="Scan RFID..."
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-950 border-2 border-emerald-500 rounded-lg text-sm text-slate-800 dark:text-white font-mono focus:outline-none animate-in fade-in"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div
                            onClick={() => user?.role === 'Admin' && handleRfidClick(u.id, u.rfid)}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-sm font-mono border border-transparent transition-colors ${user?.role === 'Admin' ? 'cursor-text hover:border-emerald-200 dark:hover:border-emerald-500/30' : ''} ${u.rfid ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 italic'}`}
                          >
                            {u.rfid || 'Belum ada RFID'}
                          </div>
                          {user?.role === 'Admin' && (
                            <button
                              onClick={() => handleRfidClick(u.id, u.rfid)}
                              className="p-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/40 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors shadow-sm"
                              title="Scan RFID"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${u.status_aktif === 'Aktif' ? 'bg-emerald-500' : 'bg-rose-500'}`} title={u.status_aktif} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden Global File Input for Admin */}
      <input type="file" accept="image/jpeg, image/png, image/webp" ref={fileInputRef} className="hidden" onChange={handlePhotoSelect} />

      {/* Modal Preview Foto */}
      {showPreviewModal && editingPhotoUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-800 dark:text-white">Foto Layar NFC ({editingPhotoUser.nama})</h3>
              <button onClick={() => { setShowPreviewModal(false); setEditingPhotoUser(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center bg-slate-100/50 dark:bg-black/20">
              <div className="w-48 h-48 rounded-full overflow-hidden shadow-lg border-[4px] border-white dark:border-slate-800">
                <img src={editingPhotoUser.foto} alt="Preview Foto NFC" className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="p-6 bg-white dark:bg-slate-900 space-y-3 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={handleEditCurrentPhoto}
                className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                </svg>
                Sesuaikan Ulang (Crop)
              </button>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                Unggah Foto Baru
              </button>

              <button
                type="button"
                onClick={() => handleDownloadPhoto(editingPhotoUser.foto, editingPhotoUser.nama)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Simpan Ke Perangkat Saat Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crop */}
      {showCropModal && imageSrc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-full">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-white">Crop Foto {editingPhotoUser?.nama}</h3>
              <button onClick={handleCropCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="relative w-full h-[300px] sm:h-[400px] bg-slate-100 dark:bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-slate-500">Zoom</span>
                <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(e.target.value)} className="w-full accent-emerald-500" />
              </div>
              
              <div className="flex gap-3">
                <button type="button" onClick={handleCropCancel} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors">Batal</button>
                <button type="button" onClick={handleUploadCroppedImage} disabled={uploadingPhoto} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all flex justify-center items-center">
                  {uploadingPhoto ? 'Menyimpan...' : 'Simpan Foto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
