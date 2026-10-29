import { NextResponse } from 'next/server';

/**
 * Proxy untuk game.rodocodo.com (Hour of Code)
 * Memalsukan User-Agent sebagai Desktop agar tidak diblokir oleh server game
 * ketika diakses dari perangkat mobile (HP/tablet).
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subPath = searchParams.get('path') || '';

    // Default ke halaman Hour of Code
    const cleanPath = subPath ? (subPath.startsWith('/') ? subPath : `/${subPath}`) : '/hour-of-code/';
    const targetUrl = `https://game.rodocodo.com${cleanPath}`;

    // Header desktop — memastikan server game tidak menolak perangkat mobile
    const response = await fetch(targetUrl, {
      headers: {
        // Palsukan sebagai Chrome Desktop Windows agar tidak diblokir di HP
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
        'Sec-Ch-Ua-Mobile': '?0',               // Beritahu server: BUKAN perangkat mobile
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return new NextResponse(`Gagal memuat game Rodocodo (${response.status})`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';

    // Jika bukan HTML (misal: CSS, JS, gambar) — teruskan langsung tanpa modifikasi
    if (!contentType.includes('text/html')) {
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    let html = await response.text();

    // Injeksi: base href agar semua aset (JS, CSS, gambar) ter-resolve ke domain aslinya
    // + viewport meta agar game tidak terpotong di layar HP
    // + hint agar pengguna memutar layar ke landscape
    const injectionScript = `
      <base href="https://game.rodocodo.com/">
      <meta name="viewport" content="width=1024, initial-scale=0.5, maximum-scale=2.0, user-scalable=yes">
      <style>
        /* Paksa game merender seolah-olah di desktop (lebar minimum 1024px) */
        html, body {
          min-width: 1024px !important;
          overflow-x: auto !important;
        }

        /* Banner anjuran landscape di HP — hanya tampil di layar sempit */
        #siakad_landscape_hint {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 2147483647;
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          gap: 8px;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 768px) and (orientation: portrait) {
          #siakad_landscape_hint {
            display: flex !important;
          }
        }

        #siakad_close_hint {
          background: rgba(255,255,255,0.25);
          border: none;
          color: white;
          border-radius: 50%;
          width: 22px;
          height: 22px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 8px;
          flex-shrink: 0;
        }
      </style>

      <!-- Banner putar layar (hanya muncul di HP portrait) -->
      <div id="siakad_landscape_hint">
        <span>📱↻</span>
        <span>Putar layar HP ke posisi <strong>Horizontal (Landscape)</strong> untuk pengalaman terbaik</span>
        <button id="siakad_close_hint" onclick="document.getElementById('siakad_landscape_hint').style.display='none'" title="Tutup">✕</button>
      </div>

      <script type="text/javascript">
        // Tangkap klik link navigasi di game agar tetap melalui proxy
        document.addEventListener('click', function(e) {
          var a = e.target.closest('a');
          if (a && a.href) {
            try {
              var url = new URL(a.href, window.location.href);
              if (url.hostname === 'game.rodocodo.com') {
                e.preventDefault();
                window.location.href = '/api/proxy-game-rodocodo?path=' + encodeURIComponent(url.pathname + url.search);
              }
            } catch(err) {}
          }
        }, true);
      </script>
    `;

    // Sisipkan tepat setelah tag <head>
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${injectionScript}`);
    } else if (html.includes('<HEAD>')) {
      html = html.replace('<HEAD>', `<HEAD>${injectionScript}`);
    } else {
      html = `${injectionScript}${html}`;
    }

    // Kembalikan response HTML tanpa X-Frame-Options / CSP yang memblokir iframe
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        // SAMEORIGIN agar hanya bisa dimuat dari domain SIAKAD kita sendiri
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch (error) {
    console.error('Error proxying game.rodocodo.com:', error);
    return new NextResponse('Terjadi kesalahan saat memuat game Rodocodo melalui proxy.', { status: 500 });
  }
}

