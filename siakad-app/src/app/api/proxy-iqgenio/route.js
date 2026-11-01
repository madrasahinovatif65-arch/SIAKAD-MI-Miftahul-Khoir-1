import { NextResponse } from 'next/server';

/**
 * Proxy untuk IQGenio (https://iqgenio.com/)
 *
 * Mengapa proxy ini diperlukan:
 * Server asli IQGenio mengirimkan header "X-Frame-Options: SAMEORIGIN" yang
 * secara otomatis memblokir situs tersebut jika dimuat langsung di dalam iframe domain lain.
 *
 * Solusi:
 * Proxy ini mengambil HTML dari server IQGenio, menghapus header proteksi iframe,
 * menyuntikkan <base href="https://iqgenio.com/"> agar aset (JS, CSS, gambar)
 * dimuat dengan tepat, serta menambahkan widget terjemahan Bahasa Indonesia.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subPath = searchParams.get('path') || '';

    const cleanPath = subPath ? (subPath.startsWith('/') ? subPath : `/${subPath}`) : '';
    const targetUrl = `https://iqgenio.com${cleanPath}`;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return new NextResponse(`Gagal memuat IQGenio (${response.status})`, { status: response.status });
    }

    let html = await response.text();

    // Hapus <base href> yang mungkin ada
    html = html.replace(/<base\s[^>]*>/gi, '');

    // Suntikkan base href & widget terjemahan mengambang
    const injectionScript = `
      <base href="https://iqgenio.com/">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
      <style>
        /* Sembunyikan banner Google Translate atas agar tidak menutupi header */
        .goog-te-banner-frame,
        iframe.goog-te-banner-frame,
        .skiptranslate > iframe,
        #goog-gt-tt,
        .goog-te-balloon-frame {
          display: none !important;
          visibility: hidden !important;
          height: 0px !important;
          width: 0px !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        html, body {
          top: 0px !important;
          position: static !important;
        }

        .goog-text-highlight {
          background: transparent !important;
          box-shadow: none !important;
        }

        /* Tombol Translate Mengambang */
        #siakad_translate_container {
          position: fixed;
          bottom: 16px;
          right: 16px;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.3s ease;
        }

        #siakad_translate_box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 6px 12px;
          border-radius: 9999px;
          box-shadow: 0 4px 18px rgba(0,0,0,0.16);
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 13px;
        }

        #siakad_translate_container.is-minimized #siakad_translate_box {
          display: none;
        }

        #siakad_toggle_btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #4338ca;
          color: white;
          border: 2px solid #ffffff;
          box-shadow: 0 3px 12px rgba(67, 56, 202, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
          user-select: none;
          flex-shrink: 0;
        }
      </style>

      <div id="siakad_translate_container">
        <div id="siakad_translate_box">
          <span style="font-weight: 600; color: #4338ca; font-size: 12px;">🇮🇩 Bahasa:</span>
          <div id="google_translate_element"></div>
        </div>
        <button id="siakad_toggle_btn" title="Buka/Tutup Menu Bahasa" onclick="toggleTranslateWidget()">
          🌐
        </button>
      </div>

      <script type="text/javascript">
        try {
          var date = new Date();
          date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
          var expires = "; expires=" + date.toUTCString();
          document.cookie = "googtrans=/en/id; path=/" + expires;
        } catch(e) {}

        function googleTranslateElementInit() {
          try {
            new google.translate.TranslateElement({
              pageLanguage: 'en',
              includedLanguages: 'id,en',
              layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
              autoDisplay: false
            }, 'google_translate_element');
          } catch(e) {}
        }

        var container = document.getElementById('siakad_translate_container');
        function toggleTranslateWidget() {
          if (container) {
            container.classList.toggle('is-minimized');
          }
        }

        setTimeout(function() {
          if (container) {
            container.classList.add('is-minimized');
          }
        }, 6000);

        function hideGoogleTopBanner() {
          if (document.body && document.body.style.top && document.body.style.top !== '0px') {
            document.body.style.top = '0px';
          }
          var banners = document.querySelectorAll('.goog-te-banner-frame, iframe.skiptranslate');
          banners.forEach(function(b) {
            b.style.display = 'none';
            b.style.visibility = 'hidden';
            b.style.height = '0px';
          });
        }
        var bannerInterval = setInterval(hideGoogleTopBanner, 300);
        setTimeout(function() { clearInterval(bannerInterval); }, 12000);

        // Pastikan klik navigasi internal tetap dalam proxy
        document.addEventListener('click', function(e) {
          var a = e.target.closest('a');
          if (a && a.href) {
            try {
              var url = new URL(a.href, window.location.href);
              if (url.hostname === 'iqgenio.com' || url.hostname === 'www.iqgenio.com') {
                e.preventDefault();
                window.location.href = '/api/proxy-iqgenio?path=' + encodeURIComponent(url.pathname + url.search);
              }
            } catch(err) {}
          }
        }, true);
      </script>
      <script type="text/javascript" src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>
    `;

      if (/<head>/i.test(html)) {
        html = html.replace(/<head>/i, `<head>${injectionScript}`);
      } else {
        html = `${injectionScript}${html}`;
      }

      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
      responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');

      return new NextResponse(html, {
        status: 200,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error('Error proxying iqgenio:', error);
      return new NextResponse('Terjadi kesalahan saat memuat IQGenio melalui proxy.', { status: 500 });
    }
  }
