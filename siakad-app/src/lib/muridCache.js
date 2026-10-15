'use client';

/**
 * muridCache.js
 * Wrapper IndexedDB untuk cache data offline role Murid.
 * DB: siakad_murid_cache | Store: murid_data
 * Key format: "nisn_<id_user>_<dataKey>"
 */

const DB_NAME = 'siakad_murid_cache';
const DB_VERSION = 1;
const STORE_NAME = 'murid_data';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Not in browser'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Simpan data ke IndexedDB cache.
 * @param {string} key - Unik per data type + user (mis. "nisn_123_riwayat_2026-01")
 * @param {*} data - Data apapun yang bisa di-JSON.stringify
 */
export async function setCacheData(key, data) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      key,
      data,
      savedAt: Date.now(),
    });
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {
    console.warn('[muridCache] setCacheData failed:', e);
  }
}

/**
 * Ambil data dari IndexedDB cache.
 * @param {string} key
 * @returns {{ data: *, savedAt: number } | null}
 */
export async function getCacheData(key) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    return new Promise((res) => {
      req.onsuccess = () => {
        const entry = req.result;
        if (!entry) return res(null);
        // Cek TTL
        if (Date.now() - entry.savedAt > CACHE_TTL_MS) return res(null);
        res(entry);
      };
      req.onerror = () => res(null);
    });
  } catch (e) {
    console.warn('[muridCache] getCacheData failed:', e);
    return null;
  }
}

/**
 * Format timestamp menjadi teks relatif (mis. "2 jam yang lalu")
 * @param {number} ms - epoch milliseconds
 * @returns {string}
 */
export function formatCacheAge(ms) {
  if (!ms) return 'tidak diketahui';
  const diffMs = Date.now() - ms;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit yang lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari yang lalu`;
}
