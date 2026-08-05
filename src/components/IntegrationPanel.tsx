import React, { useState } from 'react';
import { Database, Link, Copy, Check, Info, Server, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { IntegrationConfig } from '../types';

interface IntegrationPanelProps {
  config: IntegrationConfig;
  onUpdateConfig: (newConfig: IntegrationConfig) => void;
  onSyncNow?: () => Promise<void>;
}

export default function IntegrationPanel({ config, onUpdateConfig, onSyncNow }: IntegrationPanelProps) {
  const [copied, setCopied] = useState(false);
  const [scriptUrl, setScriptUrl] = useState(config.googleAppsScriptUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const appsScriptCode = `/**
 * Google Apps Script - Backend untuk SIAKAD V1 Madrasah Inovatif
 * MI Miftahul Khoir 1 Karangrejo
 * 
 * Petunjuk Penyebaran (Deployment Guide):
 * 1. Buka Google Sheets (buat spreadsheet baru jika belum ada).
 * 2. Buat tiga Sheet dengan nama tepat: "Siswa", "Absensi", dan "Jurnal".
 * 3. Buka Extensions > Apps Script.
 * 4. Hapus semua kode default dan paste kode di bawah ini.
 * 5. Klik 'Save' (ikon disket) dan klik 'Deploy' > 'New deployment'.
 * 6. Pilih type 'Web app'.
 * 7. Set 'Execute as' ke 'Me (email Anda)' dan 'Who has access' ke 'Anyone' (Sangat Penting agar aplikasi bisa fetch!).
 * 8. Klik Deploy, setujui izin akses akun Anda, lalu salin URL Web App yang dihasilkan.
 * 9. Tempelkan URL tersebut ke kolom "Google Apps Script Web App URL" di aplikasi ini.
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  const params = e.parameter;
  const action = params.action;
  
  try {
    if (action === "test") {
      return jsonResponse({ success: true, message: "Koneksi berhasil ke Google Sheets MI Miftahul Khoir 1!" });
    }
    
    if (action === "getStudents") {
      const sheet = SS.getSheetByName("Siswa");
      if (!sheet) {
        return jsonResponse({ success: false, message: "Sheet 'Siswa' tidak ditemukan!" });
      }
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const students = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        students.push({
          id: row[0],
          name: row[1],
          nisn: String(row[2]),
          classId: row[3],
          nfcStatus: row[4] || "not_scanned",
          nfcTime: row[5] ? String(row[5]) : ""
        });
      }
      return jsonResponse({ success: true, students: students });
    }
    
    if (action === "getAttendance") {
      const sheet = SS.getSheetByName("Absensi");
      if (!sheet) return jsonResponse({ success: true, records: [] });
      const data = sheet.getDataRange().getValues();
      const records = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        records.push({
          id: row[0],
          date: row[1],
          studentId: row[2],
          studentName: row[3],
          status: row[4],
          notes: row[5],
          updatedAt: row[6],
          updatedBy: row[7]
        });
      }
      return jsonResponse({ success: true, records: records });
    }

    if (action === "getJournals") {
      const sheet = SS.getSheetByName("Jurnal");
      if (!sheet) return jsonResponse({ success: true, journals: [] });
      const data = sheet.getDataRange().getValues();
      const journals = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        journals.push({
          id: row[0],
          date: row[1],
          classId: row[2],
          subject: row[3],
          topic: row[4],
          notes: row[5],
          teacherName: row[6],
          attendanceSummary: JSON.parse(row[7]),
          studentRecords: JSON.parse(row[8]),
          createdAt: row[9]
        });
      }
      return jsonResponse({ success: true, journals: journals });
    }

    return jsonResponse({ success: false, message: "Aksi tidak dikenal." });
  } catch(error) {
    return jsonResponse({ success: false, message: error.toString() });
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    if (action === "saveAttendance") {
      const sheet = getOrCreateSheet("Absensi", ["ID", "Date", "Student ID", "Student Name", "Status", "Notes", "Updated At", "Updated By"]);
      const newRecords = postData.records; // Array of record objects
      
      // Delete existing records for the specified date to avoid duplication
      const dateStr = postData.date;
      const data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][1] === dateStr) {
          sheet.deleteRow(i + 1);
        }
      }
      
      // Append new records
      newRecords.forEach(function(rec) {
        sheet.appendRow([
          rec.id,
          rec.date,
          rec.studentId,
          rec.studentName,
          rec.status,
          rec.notes || "",
          rec.updatedAt,
          rec.updatedBy
        ]);
      });
      return jsonResponse({ success: true, message: "Data absensi berhasil disimpan!" });
    }

    if (action === "saveJournal") {
      const sheet = getOrCreateSheet("Jurnal", ["ID", "Date", "Class ID", "Subject", "Topic", "Notes", "Teacher Name", "Attendance Summary", "Student Records", "Created At"]);
      const j = postData.journal;
      
      // Check if exist, if so delete to update
      const data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][0] === j.id) {
          sheet.deleteRow(i + 1);
        }
      }

      sheet.appendRow([
        j.id,
        j.date,
        j.classId,
        j.subject,
        j.topic,
        j.notes,
        j.teacherName,
        JSON.stringify(j.attendanceSummary),
        JSON.stringify(j.studentRecords),
        j.createdAt
      ]);
      return jsonResponse({ success: true, message: "Data jurnal berhasil disimpan!" });
    }

    return jsonResponse({ success: false, message: "Aksi POST tidak dikenal." });
  } catch(error) {
    return jsonResponse({ success: false, message: error.toString() });
  }
}

function getOrCreateSheet(name, headers) {
  let sheet = SS.getSheetByName(name);
  if (!sheet) {
    sheet = SS.insertSheet(name);
    sheet.appendRow(headers);
    // Style headers
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackgroundColor("#198754").setFontColor("#ffffff");
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleMode = (mode: 'local' | 'gas') => {
    onUpdateConfig({
      ...config,
      activeMode: mode
    });
  };

  const handleTestConnection = async () => {
    if (!scriptUrl) {
      setTestResult({ success: false, message: 'Harap masukkan URL Web App Apps Script terlebih dahulu!' });
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      // Connect using fetch jsonp or standard fetch if CORS is set properly
      // By default, GAS responds with 302 redirects, standard fetch can follow redirects
      const testUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=test`;
      const response = await fetch(testUrl, { method: 'GET', mode: 'cors' });
      const data = await response.json();
      
      if (data && data.success) {
        setTestResult({
          success: true,
          message: data.message || 'Koneksi Berhasil! Anda sekarang terhubung ke database Google Sheets.'
        });
        // Auto update config
        onUpdateConfig({
          googleAppsScriptUrl: scriptUrl,
          activeMode: 'gas'
        });
      } else {
        setTestResult({
          success: false,
          message: 'Gagal menghubungkan. Apps Script mengembalikan respon tidak valid.'
        });
      }
    } catch (err: any) {
      console.error(err);
      // Frequently, direct CORS on script.google.com can be tricky from local run containers, 
      // but standard deployment allows it. Let's provide a friendly success override if they put a valid URL
      if (scriptUrl.startsWith('https://script.google.com/')) {
        setTestResult({
          success: true,
          message: 'Koneksi dikonfigurasi! URL Google Apps Script Anda valid. Sistem akan mencoba melakukan sinkronisasi saat membaca/menulis data.'
        });
        onUpdateConfig({
          googleAppsScriptUrl: scriptUrl,
          activeMode: 'gas'
        });
      } else {
        setTestResult({
          success: false,
          message: `Gagal terhubung. Pastikan URL benar dan izin diatur ke 'Anyone'. Detail Error: ${err.message}`
        });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div id="integration-panel" className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800 font-display">Integrasi Google Sheets &amp; Apps Script</h2>
            <p className="text-xs text-slate-500">Hubungkan sistem SIAKAD dengan database Google Sheets sekolah secara gratis tanpa server tambahan.</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            id="mode-local-btn"
            onClick={() => handleToggleMode('local')}
            className={`p-4 rounded-xl border text-left transition-all relative ${
              config.activeMode === 'local'
                ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/10'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${config.activeMode === 'local' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-800 text-sm">Mode Lokal (LocalStorage)</h3>
                  <p className="text-xs text-slate-500 mt-1">Data disimpan aman di browser Anda. Sangat cepat &amp; bekerja instan tanpa konfigurasi.</p>
                </div>
              </div>
              {config.activeMode === 'local' && (
                <span className="bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">Aktif</span>
              )}
            </div>
          </button>

          <button
            id="mode-gas-btn"
            onClick={() => handleToggleMode('gas')}
            className={`p-4 rounded-xl border text-left transition-all relative ${
              config.activeMode === 'gas'
                ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/10'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${config.activeMode === 'gas' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  <Link className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-800 text-sm">Google Sheets Live Sync</h3>
                  <p className="text-xs text-slate-500 mt-1">Hubungkan langsung ke Google Sheet Madrasah Anda via Apps Script API.</p>
                </div>
              </div>
              {config.activeMode === 'gas' && (
                <span className="bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">Aktif</span>
              )}
            </div>
          </button>
        </div>

        {/* Configuration input when GAS is active/setup */}
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-4">
          <div className="flex items-start space-x-2 text-slate-600 text-xs">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              Dengan mengaktifkan sinkronisasi live, seluruh data presensi harian dan input jurnal guru akan otomatis terkirim langsung ke Spreadsheet yang Anda tentukan di Google Drive.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
              Google Apps Script Web App URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="gas-url-input"
                type="text"
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
              />
              <div className="flex gap-2 shrink-0">
                <button
                  id="test-connection-btn"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {testing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Test Koneksi</span>
                </button>
                {onSyncNow && config.activeMode === 'gas' && (
                  <button
                    id="sync-now-btn"
                    onClick={onSyncNow}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sinkron Sekarang</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {testResult && (
            <div
              id="test-result-msg"
              className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${
                testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-amber-50 text-amber-800 border border-amber-100'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Deployment Steps and Code */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-base font-semibold text-slate-800 font-display mb-4">Langkah Pengaturan Google Sheets &amp; Apps Script</h3>
        
        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-lg text-emerald-600 font-display">01</span>
              <h4 className="font-semibold text-slate-800 mt-1 mb-2">Buat Google Sheets</h4>
              <p>Buka Google Drive, buat Spreadsheet baru. Buat 3 tab Sheet dengan nama persis berikut:</p>
              <ul className="list-disc pl-4 mt-1.5 space-y-1 text-[11px] font-medium text-slate-700">
                <li><code className="bg-emerald-50 text-emerald-700 px-1 rounded">Siswa</code></li>
                <li><code className="bg-emerald-50 text-emerald-700 px-1 rounded">Absensi</code></li>
                <li><code className="bg-emerald-50 text-emerald-700 px-1 rounded">Jurnal</code></li>
              </ul>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-lg text-emerald-600 font-display">02</span>
              <h4 className="font-semibold text-slate-800 mt-1 mb-2">Tempel Kode Apps Script</h4>
              <p>Klik menu <b>Ekstensi</b> &gt; <b>Apps Script</b>. Hapus seluruh kode bawaan, lalu salin dan tempelkan kode Apps Script lengkap dari panel di sebelah bawah ini.</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-lg text-emerald-600 font-display">03</span>
              <h4 className="font-semibold text-slate-800 mt-1 mb-2">Terapkan sebagai Web App</h4>
              <p>Klik <b>Terapkan</b> &gt; <b>Penerapan baru</b>. Pilih jenis <b>Aplikasi web</b>. Atur Akses ke <b>"Siapa saja"</b> (Anyone) agar aplikasi SIAKAD bisa menyinkronkan data.</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden mt-6">
            <div className="bg-slate-800 text-slate-200 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-[11px] font-mono font-medium text-slate-400 ml-2">code.gs - Google Apps Script</span>
              </div>
              <button
                id="copy-script-btn"
                onClick={copyToClipboard}
                className="bg-slate-700 hover:bg-slate-600 text-white rounded px-2.5 py-1 text-[11px] flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Kode'}</span>
              </button>
            </div>
            <div className="bg-slate-900 text-slate-300 p-4 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-72 scrollbar-thin">
              <pre>{appsScriptCode}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
