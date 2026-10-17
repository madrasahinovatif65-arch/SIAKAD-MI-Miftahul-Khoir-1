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
        /* Sembunyikan top banner bawaan Google Translate agar tidak merusak layout */
        .goog-te-banner-frame.skiptranslate { display: none !important; }
        body { top: 0px !important; }
        #siakad_translate_box {
          position: fixed;
          bottom: 16px;
          right: 16px;
          z-index: 2147483647;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 8px 14px;
          border-radius: 9999px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
        }
      </style>
      <div id="siakad_translate_box">
        <span style="font-weight: 600; color: #4338ca;">🇮🇩 Terjemahan:</span>
        <div id="google_translate_element"></div>
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
            autoDisplay: true
          }, 'google_translate_element');
        }

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
