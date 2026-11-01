import { NextResponse } from 'next/server';

/**
 * Proxy untuk Portal SIBI Kemendikdasmen (buku.kemendikdasmen.go.id/katalog)
 *
 * Mengapa proxy ini diperlukan:
 * Server resmi Kemendikdasmen (nginx) mengirimkan header keamanan:
 * "X-Frame-Options: SAMEORIGIN"
 * Header ini secara otomatis memblokir portal SIBI jika dimuat langsung di dalam
 * <iframe> pada website eksternal mana pun (browser akan menampilkan "refused to connect").
 *
 * Solusi:
 * 1. Proxy ini mengambil HTML dari server resmi Kemendikdasmen dengan header browser desktop.
 * 2. Menghapus header pembatas "X-Frame-Options" dari respon agar dapat ditampilkan di iframe aplikasi SIAKAD.
 * 3. Menyuntikkan <base href="https://buku.kemendikdasmen.go.id/"> agar aset statis (CSS, JS, gambar)
 *    ter-resolve langsung ke domain resmi Kemendikdasmen.
 * 4. SIBI menggunakan React Router SPA. URL diubah secara instan ke "/katalog" melalui
 *    history.replaceState sebelum bundle React Router dieksekusi agar rute katalog termuat dengan benar.
 * 5. Menetralkan pemanggilan navigator.serviceWorker agar aman di insecure context (HTTP/IP jaringan).
 */
export async function GET() {
  try {
    const targetUrl = 'https://buku.kemendikdasmen.go.id/katalog';

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return new NextResponse(`Gagal memuat Katalog Buku Kemendikdasmen (${response.status})`, {
        status: response.status,
      });
    }

    let html = await response.text();

    // Hapus <base href> dan manifest bawaan agar tidak konflik
    html = html.replace(/<base\s[^>]*>/gi, '');
    html = html.replace(/<link\s+rel=["']manifest["'][^>]*>/gi, '');

    // Amankan script unregister serviceWorker agar tidak crash di context HTTP / mobile
    html = html.replace(
      /<script>\s*navigator\.serviceWorker\.getRegistrations\(\)[\s\S]*?<\/script>/gi,
      '<script>try{if(window.navigator&&navigator.serviceWorker&&navigator.serviceWorker.getRegistrations){navigator.serviceWorker.getRegistrations().then(function(e){for(let r of e)r.unregister()}).catch(function(){})}}catch(e){}</script>'
    );

    const injectionScript = `
      <script>
        // 1. Monkey-patch pushState & replaceState agar URL internal SPA selalu menggunakan origin SIAKAD
        // Ini mencegah DOMException SecurityError ketika <base href="..."> aktif
        (function() {
          var origPush = History.prototype.pushState;
          var origReplace = History.prototype.replaceState;
          var appOrigin = window.location.origin;

          function toSameOrigin(url) {
            if (!url) return url;
            try {
              var str = String(url);
              var parsed;
              if (str.startsWith('http://') || str.startsWith('https://')) {
                parsed = new URL(str);
              } else {
                parsed = new URL(str, 'https://buku.kemendikdasmen.go.id/');
              }
              if (parsed.origin === 'https://buku.kemendikdasmen.go.id' || parsed.origin === appOrigin) {
                return appOrigin + parsed.pathname + parsed.search + parsed.hash;
              }
              return url;
            } catch(e) {
              return url;
            }
          }

          History.prototype.pushState = function(state, title, url) {
            return origPush.call(this, state, title, toSameOrigin(url));
          };

          History.prototype.replaceState = function(state, title, url) {
            return origReplace.call(this, state, title, toSameOrigin(url));
          };

          // 2. Arahkan rute aktif frame langsung ke /katalog sebelum React Router menginisialisasi
          try {
            if (window.location.pathname !== '/katalog') {
              origReplace.call(window.history, null, '', appOrigin + '/katalog');
            }
          } catch(e) {
            console.warn('replaceState warning:', e);
          }
        })();

        // Pastikan link download buku / PDF / eksternal dibuka di tab baru agar tidak memutus iframe
        document.addEventListener('click', function(e) {
          var a = e.target.closest('a');
          if (a && a.href) {
            try {
              var url = new URL(a.href, window.location.href);
              if (url.pathname.endsWith('.pdf') || url.pathname.includes('/download/')) {
                a.setAttribute('target', '_blank');
              } else if (url.origin !== window.location.origin && url.origin !== 'https://buku.kemendikdasmen.go.id') {
                a.setAttribute('target', '_blank');
              }
            } catch(err) {}
          }
        }, false);
      </script>
      <base href="https://buku.kemendikdasmen.go.id/">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
      <style>
        body {
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch;
        }
      </style>
    `;

    if (/<head>/i.test(html)) {
      html = html.replace(/<head>/i, `<head>${injectionScript}`);
    } else {
      html = `${injectionScript}${html}`;
    }

    // Kembalikan HTML TANPA X-Frame-Options agar bebas dimuat di dalam iframe SIAKAD
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    return new NextResponse(html, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Error proxying buku kemendikdasmen:', error);
    return new NextResponse('Terjadi kesalahan saat memuat Katalog Buku melalui proxy.', { status: 500 });
  }
}
