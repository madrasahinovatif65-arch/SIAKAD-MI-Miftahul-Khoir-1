import React from 'react';

export default function AbsenModal({ isOpen, onClose, rekapAbsen, siswaData, absensiMapel, handleStatusChange }) {
  if (!isOpen) return null;

  const statusOptions = ['Hadir', 'Sakit', 'Izin', 'Alfa'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg max-w-lg w-full mx-4 p-6 overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Detail Absensi</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div className="text-emerald-600 dark:text-emerald-400">Hadir: {rekapAbsen?.Hadir ?? 0}</div>
          <div className="text-amber-500">Sakit: {rekapAbsen?.Sakit ?? 0}</div>
          <div className="text-blue-500">Izin: {rekapAbsen?.Izin ?? 0}</div>
          <div className="text-rose-500">Alfa: {rekapAbsen?.Alfa ?? 0}</div>
        </div>
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-700">
              <th className="px-2 py-1 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Nama</th>
              <th className="px-2 py-1 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Status</th>
            </tr>
          </thead>
          <tbody>
            {siswaData?.murid?.map(m => (
              <tr key={m.id_user} className="border-b border-slate-200 dark:border-slate-600">
                <td className="px-2 py-1 text-sm text-slate-800 dark:text-slate-200">{m.nama}</td>
                <td className="px-2 py-1">
                  <select
                    value={absensiMapel[m.id_user] ?? 'Hadir'}
                    onChange={e => handleStatusChange(m.id_user, e.target.value)}
                    className="rounded border border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {statusOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
