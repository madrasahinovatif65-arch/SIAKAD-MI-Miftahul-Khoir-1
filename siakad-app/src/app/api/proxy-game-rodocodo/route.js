import { NextResponse } from 'next/server';

// User-Agent desktop yang dipalsukan — server game.rodocodo.com memblokir UA mobile
// dengan me-redirect ke Google Play Store
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DESKTOP_HEADERS = {
  'User-Agent': DESKTOP_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
  'Sec-Ch-Ua-Mobile': '?0',         // Beritahu server: BUKAN mobile
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'no-cache',
};

/**
 * Rewrite semua URL dalam HTML agar semua aset (JS, CSS, gambar, font)
 * ikut dilewatkan melalui proxy ini — sehingga browser HP tidak pernah
 * langsung menghubungi game.rodocodo.com dengan UA mobile-nya sendiri.
 */
function rewriteHtml(html, proxyBase) {
  // Hapus <base href> yang ditetapkan oleh halaman asli
  html = html.replace(/<base\s[^>]*>/gi, '');

  // Rewrite URL absolut game.rodocodo.com → lewat proxy kita
  // Tangani href="...", src="...", url(...) dalam CSS inline, dsb.
  const rewriteUrl = (url) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'game.rodocodo.com') {
        return `${proxyBase}?path=${encodeURIComponent(parsed.pathname + parsed.search + parsed.hash)}`;
      }
    } catch (_) {}
    // URL relatif: jadikan absolut melalui proxy
    if (url.startsWith('/') && !url.startsWith('//')) {
      return `${proxyBase}?path=${encodeURIComponent(url)}`;
    }
    return url;
  };

  // Rewrite atribut src dan href
  html = html.replace(/\b(src|href|action)="([^"]+)"/gi, (match, attr, url) => {
    // Jangan rewrite link eksternal seperti google, cdn, dll.
    if (url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('tel:')) return match;
    if (url.startsWith('//')) return match; // protocol-relative biarkan
    if (url.includes('://') && !url.includes('game.rodocodo.com')) return match;
    return `${attr}="${rewriteUrl(url)}"`;
  });

  // Rewrite url() dalam style inline / tag <style>
  html = html.replace(/url\(['"]?(\/[^'")\s]+)['"]?\)/gi, (match, url) => {
    return `url('${proxyBase}?path=${encodeURIComponent(url)}')`;
  });

  return html;
}

export async function GET(request) {
  try {
    const { searchParams, origin, pathname } = new URL(request.url);
    const subPath = searchParams.get('path') || '';

    // Base URL proxy ini (untuk rewriting)
    const proxyBase = `${origin}/api/proxy-game-rodocodo`;

    // Default ke halaman Hour of Code
    const cleanPath = subPath
      ? subPath.startsWith('/') ? subPath : `/${subPath}`
      : '/hour-of-code/';

    const targetUrl = `https://game.rodocodo.com${cleanPath}`;

    // Kirim request ke server dengan UA desktop
    const response = await fetch(targetUrl, {
      headers: {
        ...DESKTOP_HEADERS,
        // Untuk aset (JS/CSS/gambar), sesuaikan Accept dan Referer
        'Accept': subPath && !subPath.endsWith('/') && !subPath.endsWith('.html')
          ? '*/*'
          : DESKTOP_HEADERS['Accept'],
        'Referer': 'https://game.rodocodo.com/',
      },
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!response.ok) {
      return new NextResponse(
        `Gagal memuat (${response.status} ${response.statusText}): ${targetUrl}`,
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // === Konten BUKAN HTML (JS, CSS, gambar, font, wasm, dll.) ===
    // Teruskan langsung tanpa modifikasi
    if (!contentType.includes('text/html')) {
      const buffer = await response.arrayBuffer();
      const headers = {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      };
      // Untuk JS: rewrite URL internal jika ada referensi ke game.rodocodo.com
      if (contentType.includes('javascript') || contentType.includes('text/plain')) {
        let jsText = Buffer.from(buffer).toString('utf-8');
        jsText = jsText.replace(
          /["'](https?:\/\/game\.rodocodo\.com)(\/[^"']*)?["']/g,
          (match, base, path) => {
            const p = path || '/';
            const quote = match[0];
            return `${quote}${proxyBase}?path=${encodeURIComponent(p)}${quote}`;
          }
        );
        return new NextResponse(jsText, { status: 200, headers: { ...headers, 'Content-Type': 'application/javascript; charset=utf-8' } });
      }
      return new NextResponse(buffer, { status: 200, headers });
    }

    // === Konten HTML ===
    let html = await response.text();

    // Cek apakah server me-redirect ke Google Play (tanda UA mobile terdeteksi)
    if (html.includes('play.google.com') && html.includes('WIZ_global_data')) {
      return new NextResponse(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff8f0;text-align:center;padding:24px;}
          .card{background:white;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.1);max-width:400px;}
          h2{color:#f97316;margin:0 0 12px;}p{color:#64748b;font-size:14px;line-height:1.6;}
          a{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:12px 24px;background:#f97316;color:white;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;}
        </style></head><body>
          <div class="card">
            <div style="font-size:48px;margin-bottom:16px;">🎮</div>
            <h2>Belajar Coding Dasar</h2>
            <p>Game Rodocodo tidak bisa dibuka langsung di dalam aplikasi pada perangkat ini.</p>
            <p>Silakan klik tombol di bawah untuk memainkannya di tab browser baru:</p>
            <a href="https://game.rodocodo.com/hour-of-code/" target="_blank" rel="noopener noreferrer">
              🚀 Buka Game Rodocodo
            </a>
            <p style="margin-top:16px;font-size:12px;color:#94a3b8;">
              💡 <strong>Tips:</strong> Setelah terbuka, ketuk menu browser → "Minta Situs Desktop" untuk tampilan terbaik.
            </p>
          </div>
        </body></html>`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'SAMEORIGIN' }
        }
      );
    }

    // Rewrite semua URL internal agar melalui proxy
    html = rewriteHtml(html, proxyBase);

    // Injeksi: override deteksi mobile client-side + viewport + landscape hint
    const injection = `
      <meta name="viewport" content="width=1024, initial-scale=0.5, maximum-scale=3.0, user-scalable=yes">
      <script>
        // Override deteksi perangkat mobile oleh JavaScript game
        (function() {
          try {
            // Override navigator.userAgent
            Object.defineProperty(navigator, 'userAgent', {
              get: function() { return '${DESKTOP_UA.replace(/'/g, "\\'")}'; },
              configurable: true
            });
            // Beritahu game bahwa tidak ada touch (desktop)
            Object.defineProperty(navigator, 'maxTouchPoints', {
              get: function() { return 0; },
              configurable: true
            });
            Object.defineProperty(navigator, 'msMaxTouchPoints', {
              get: function() { return 0; },
              configurable: true
            });
            Object.defineProperty(navigator, 'platform', {
              get: function() { return 'Win32'; },
              configurable: true
            });
            // Sembunyikan event touch dari window sehingga game tidak tahu ada touch
            Object.defineProperty(window, 'ontouchstart', {
              get: function() { return undefined; },
              configurable: true
            });
          } catch(e) {}
        })();
      </script>
      <style>
        html, body { min-width: 1024px !important; overflow-x: auto !important; }
        #siakad_landscape_hint {
          display: none;
          position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: white; font-family: system-ui, sans-serif; font-size: 13px;
          font-weight: 600; padding: 8px 16px; text-align: center;
          align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        @media (max-width: 768px) and (orientation: portrait) {
          #siakad_landscape_hint { display: flex !important; }
        }
      </style>
      <div id="siakad_landscape_hint">
        <span>&#x1F4F1; Putar layar ke <strong>Horizontal (Landscape)</strong> untuk tampilan terbaik</span>
        <button onclick="this.parentElement.style.display='none'"
          style="background:rgba(255,255,255,0.3);border:none;color:white;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px;margin-left:8px;">&#x2715;</button>
      </div>
    `;

    if (html.toLowerCase().includes('<head>')) {
      html = html.replace(/<head>/i, `<head>${injection}`);
    } else {
      html = injection + html;
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch (error) {
    console.error('[proxy-game-rodocodo] Error:', error);
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
        <p style="font-family:sans-serif;padding:24px;color:#dc2626;">
          Terjadi kesalahan saat memuat game: ${error.message}
        </p>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
