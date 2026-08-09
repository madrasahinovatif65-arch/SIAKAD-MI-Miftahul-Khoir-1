import React from 'react';

export default function AbsenModal({ isOpen, onClose, rekapAbsen, siswaData, absensiMapel, handleStatusChange }) {
  if (!isOpen) return null;

  const statusOptions = ['Hadir', 'Sakit', 'Izin', 'Alfa'];

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4 transition-all" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Detail Absensi Kelas</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-full transition-colors">
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2 sm:p-3 rounded-xl border border-emerald-100 dark:border-emerald-500/20 text-center">
              <div className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-0.5 sm:mb-1 uppercase">Hadir</div>
              <div className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-300">{rekapAbsen?.Hadir ?? 0}</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 p-2 sm:p-3 rounded-xl border border-amber-100 dark:border-amber-500/20 text-center">
              <div className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-semibold mb-0.5 sm:mb-1 uppercase">Sakit</div>
              <div className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-300">{rekapAbsen?.Sakit ?? 0}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-500/10 p-2 sm:p-3 rounded-xl border border-blue-100 dark:border-blue-500/20 text-center">
              <div className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 font-semibold mb-0.5 sm:mb-1 uppercase">Izin</div>
              <div className="text-base sm:text-lg font-bold text-blue-700 dark:text-blue-300">{rekapAbsen?.Izin ?? 0}</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-500/10 p-2 sm:p-3 rounded-xl border border-rose-100 dark:border-rose-500/20 text-center">
              <div className="text-[10px] sm:text-xs text-rose-600 dark:text-rose-400 font-semibold mb-0.5 sm:mb-1 uppercase">Alfa</div>
              <div className="text-base sm:text-lg font-bold text-rose-700 dark:text-rose-300">{rekapAbsen?.Alfa ?? 0}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Siswa</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {siswaData?.murid?.map(m => (
                  <tr key={m.id_user} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">{m.nama}</td>
                    <td className="px-4 py-3">
                      <select
                        value={absensiMapel[m.id_user] ?? 'Hadir'}
                        onChange={e => handleStatusChange(m.id_user, e.target.value)}
                        className={`w-full text-sm font-semibold rounded-lg border-0 py-2 pl-3 pr-8 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6
                          ${(absensiMapel[m.id_user] ?? 'Hadir') === 'Hadir' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 focus:ring-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' : ''}
                          ${absensiMapel[m.id_user] === 'Sakit' ? 'bg-amber-50 text-amber-700 ring-amber-200 focus:ring-amber-500 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20' : ''}
                          ${absensiMapel[m.id_user] === 'Izin' ? 'bg-blue-50 text-blue-700 ring-blue-200 focus:ring-blue-500 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20' : ''}
                          ${absensiMapel[m.id_user] === 'Alfa' ? 'bg-rose-50 text-rose-700 ring-rose-200 focus:ring-rose-500 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20' : ''}
                        `}
                      >
                        {statusOptions.map(opt => (
                          <option key={opt} value={opt} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">{opt}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
          <button onClick={onClose} className="w-full px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:bg-emerald-500 transition-all active:scale-95">
            Tutup & Simpan Sementara
          </button>
        </div>
      </div>
    </div>
  );
}
