// Helper & API Client untuk Web Push Notification

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isPushNotificationSupported() {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushNotificationStatus() {
  if (!isPushNotificationSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      isSubscribed: false,
      isLocallyDisabled: false,
      isActive: false,
    };
  }

  const permission = Notification.permission;
  const isLocallyDisabled = localStorage.getItem('push_notif_disabled') === 'true';

  let isSubscribed = false;
  let subscription = null;

  try {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (_) {}
      const reg = await navigator.serviceWorker.ready;
      subscription = await reg.pushManager.getSubscription();
      isSubscribed = !!subscription;
    }
  } catch (e) {
    console.warn('[Push] Error getting push subscription:', e);
  }

  return {
    supported: true,
    permission,
    isSubscribed,
    subscription,
    isLocallyDisabled,
    isActive: permission === 'granted' && isSubscribed && !isLocallyDisabled,
  };
}

export async function subscribeUserToPush(userId) {
  if (!isPushNotificationSupported()) {
    throw new Error('Notifikasi push tidak didukung pada peramban/browser ini.');
  }

  // 1. Minta izin notifikasi
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    if (permission === 'denied') {
      throw new Error('Izin notifikasi diblokir oleh browser. Silakan izinkan di pengaturan situs browser Anda.');
    }
    throw new Error('Izin notifikasi belum disetujui.');
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    throw new Error('VAPID Public Key belum dikonfigurasi di sistem.');
  }

  // 2. Pastikan service worker ready
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (_) {}
  const registration = await navigator.serviceWorker.ready;

  // 3. Ambil subscription atau buat baru
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  // 4. Simpan ke database via endpoint API
  if (userId && subscription) {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_user: userId, subscription }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal menyimpan subscription ke server.');
    }
  }

  // 5. Hapus flag disabled lokal
  localStorage.removeItem('push_notif_disabled');

  return subscription;
}

export async function unsubscribeUserFromPush() {
  if (!isPushNotificationSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Hapus dari database server
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch((e) => console.warn('[Push] Gagal hapus sub dari server:', e));

      // Unsubscribe pushManager lokal
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.error('[Push] Error saat unsubscribe:', err);
  } finally {
    // Simpan preferensi pengguna agar tidak otomatis subscribe lagi
    localStorage.setItem('push_notif_disabled', 'true');
  }
}

export async function sendLocalTestNotification() {
  if (!isPushNotificationSupported()) {
    throw new Error('Peramban tidak mendukung notifikasi.');
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Izin notifikasi belum diaktifkan.');
  }

  const title = 'Uji Coba Notifikasi SIAKAD 🔔';
  const options = {
    body: 'Notifikasi berhasil terhubung! Anda akan menerima update absensi, jadwal, dan info madrasah langsung di perangkat ini.',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: { url: '/dashboard/notifikasi' },
    tag: 'siakad-test-' + Date.now(),
  };

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration && registration.showNotification) {
      await registration.showNotification(title, options);
      return;
    }
  } catch (_) {}

  // Fallback
  new Notification(title, options);
}
