import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subPath = searchParams.get('path') || '';

    // Pastikan subPath aman dan diawali dengan slash jika ada
    const cleanPath = subPath ? (subPath.startsWith('/') ? subPath : `/${subPath}`) : '';
    const targetUrl = `https://iqgenio.com${cleanPath}`;

    // Ambil konten HTML mentah dari IQGenio
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

    // Suntikkan base href agar semua aset gambar, css, font, audio ter-resolve ke domain IQGenio
    const baseTag = `<base href="https://iqgenio.com/">`;

    // Suntikkan script Google Translate Widget & navigasi interceptor
    const injectionScript = `
      <base href="https://iqgenio.com/">
      <style>
        /* 1. Sembunyikan TOTAL banner Google Translate bagian atas (seperti di screenshot) */
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

        /* 2. Pastikan posisi body tidak tergeser ke bawah oleh Google */
        html, body {
          top: 0px !important;
          position: static !important;
        }

        /* 3. Hilangkan efek highlight teks kuning Google Translate */
        .goog-text-highlight {
          background: transparent !important;
          box-shadow: none !important;
        }

        /* 4. Widget Terjemahan Mengapung dengan fitur Auto-Hide */
        #siakad_translate_container {
          position: fixed;
          bottom: 16px;
          right: 16px;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
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
          transition: opacity 0.3s ease, transform 0.3s ease;
        }

        /* State ketika diminimize / auto-hide */
        #siakad_translate_container.is-minimized #siakad_translate_box {
          opacity: 0;
          transform: scale(0.8) translateX(20px);
          pointer-events: none;
          position: absolute;
          right: 48px;
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
          transition: transform 0.2s ease, background-color 0.2s ease;
          flex-shrink: 0;
        }

        #siakad_toggle_btn:hover {
          transform: scale(1.08);
          background: #3730a3;
        }
      </style>

      <!-- Widget Terjemahan dengan Auto-Hide & Toggle -->
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
        // Set cookie translate ke Bahasa Indonesia secara default
        try {
          var date = new Date();
          date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
          var expires = "; expires=" + date.toUTCString();
          document.cookie = "googtrans=/en/id; path=/" + expires;
        } catch(e) {}

        function googleTranslateElementInit() {
          new google.translate.TranslateElement({
            pageLanguage: 'en',
            includedLanguages: 'id,en',
            layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false
          }, 'google_translate_element');
        }

        // Fungsi toggle & auto-hide
        var container = document.getElementById('siakad_translate_container');
        function toggleTranslateWidget() {
          if (container) {
            container.classList.toggle('is-minimized');
          }
        }

        // Auto-hide otomatis setelah 5 detik agar tidak menutupi layar kuis
        setTimeout(function() {
          if (container) {
            container.classList.add('is-minimized');
          }
        }, 5000);

        // Pengawas (Observer) ketat untuk membasmi banner atas Google Translate jika muncul
        function hideGoogleTopBanner() {
          if (document.body.style.top && document.body.style.top !== '0px') {
            document.body.style.top = '0px';
          }
          var banners = document.querySelectorAll('.goog-te-banner-frame, iframe.skiptranslate');
          banners.forEach(function(b) {
            b.style.display = 'none';
            b.style.visibility = 'hidden';
            b.style.height = '0px';
          });
        }

        var bannerInterval = setInterval(hideGoogleTopBanner, 200);
        setTimeout(function() { clearInterval(bannerInterval); }, 15000);

        // Tangkap klik link navigasi agar tetap melalui proxy SIAKAD
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

    // Sisipkan tepat setelah tag <head>
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${injectionScript}`);
    } else {
      html = `${injectionScript}${html}`;
    }

    // Kembalikan response HTML dengan menghapus X-Frame-Options dan CSP
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        // Izinkan halaman ini dimuat di iframe dalam origin aplikasi kita
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch (error) {
    console.error('Error proxying iqgenio:', error);
    return new NextResponse('Terjadi kesalahan saat memuat IQGenio melalui proxy.', { status: 500 });
  }
}
