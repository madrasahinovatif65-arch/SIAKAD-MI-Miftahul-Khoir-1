import { NextResponse } from 'next/server';

  /**
   * Proxy untuk Rodocodo Code Hour (game.rodocodo.com/hour-of-code/)
   *
   * Mengapa proxy ini diperlukan:
   * Server game.rodocodo.com memeriksa User-Agent. Jika dibuka langsung dari browser
   * HP (Android / iOS / iPad), server mereka mengembalikan HTTP 302 Redirect ke
   * Google Play Store atau Apple App Store.
   * Browser melarang pembukaan halaman App Store / Play Store di dalam <iframe>.
   *
   * Solusi:
   * Proxy ini mengambil HTML halaman game menggunakan Desktop User-Agent sehingga
   * server Rodocodo mengembalikan konten HTML game Unity WebGL (bukan redirect ke Play Store).
   * Dengan menyuntikkan <base href="https://game.rodocodo.com/hour-of-code/">,
   * semua aset statis (loader.js, wasm.br, data.br, css, gambar) dimuat langsung
   * dari CDN Cloudflare Rodocodo yang mengizinkan akses ke semua perangkat.
   */
  export async function GET() {
    try {
      const targetUrl = 'https://game.rodocodo.com/hour-of-code/';

      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
          return new NextResponse(`Gagal memuat game Rodocodo (${response.status})`, {
            status: response.status,
          });
        }

    let html = await response.text();

        // Hapus <base href> yang mungkin sudah ada
        html = html.replace(/<base\s[^>]*>/gi, '');

        // Injeksi base href dengan trailing slash agar path relatif seperti hoc122/Build/...
        // tepat mengarah ke https://game.rodocodo.com/hour-of-code/...
        const injection = `
      <base href="https://game.rodocodo.com/hour-of-code/">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes">
      <style>
        /* Pastikan canvas Unity selalu memenuhi kontainer iframe dengan proporsional */
        html, body {
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #231F20 !important;
        }
        #unity-container {
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        #unity-canvas {
          max-width: 100% !important;
          max-height: 100% !important;
          object-fit: contain !important;
        }
        /* Banner hint landscape di HP portrait */
        #_landscape_hint {
          display: none;
          position: fixed;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2147483647;
          background: rgba(249, 115, 22, 0.95);
          color: white;
          padding: 6px 14px;
          border-radius: 9999px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          pointer-events: none;
        }
        @media (max-width: 768px) and (orientation: portrait) {
          #_landscape_hint {
            display: block !important;
          }
        }
      </style>
      <div id="_landscape_hint">📱 Putar layar ke posisi Landscape untuk tampilan lebih luas</div>
    `;

        if (/<head>/i.test(html)) {
          html = html.replace(/<head>/i, `<head>${injection}`);
        } else {
          html = `${injection}${html}`;
        }

        // Kembalikan response tanpa X-Frame-Options agar bisa ditampilkan di iframe aplikasi SIAKAD
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
        responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');

        return new NextResponse(html, {
          status: 200,
          headers: responseHeaders,
        });
      } catch (error) {
        console.error('[proxy-game-rodocodo] Error:', error);
        return new NextResponse('Terjadi kesalahan saat memuat game Rodocodo.', { status: 500 });
      }
    }
