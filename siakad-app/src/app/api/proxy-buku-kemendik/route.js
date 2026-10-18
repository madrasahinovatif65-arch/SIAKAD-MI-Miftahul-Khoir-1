import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subPath = searchParams.get('path') || '/katalog';

    const cleanPath = subPath.startsWith('/') ? subPath : `/${subPath}`;
    const targetUrl = `https://buku.kemendikdasmen.go.id${cleanPath}`;

    // Ambil konten HTML dari portal SIBI Kemendikdasmen
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return new NextResponse(`Gagal memuat Katalog Buku Kemendikdasmen (${response.status})`, { status: response.status });
    }

    let html = await response.text();

    // SIBI adalah React SPA (Create React App + React Router).
    // Jika dimuat di dalam iframe melalui URL /api/proxy-buku-kemendik, React Router
    // akan mengecek window.location.pathname dan menampilkan halaman 404 (Oops!) karena
    // rute '/api/proxy-buku-kemendik' tidak terdaftar di router SIBI.
    // Solusi: Sebelum bundle JS SIBI dieksekusi, jalankan window.history.replaceState
    // agar pathname diubah menjadi '/katalog' (atau cleanPath), sehingga React Router
    // langsung memuat katalog buku dengan benar tanpa memicu reload.
    const injectionScript = `
      <base href="https://buku.kemendikdasmen.go.id/">
      <script type="text/javascript">
        // 1. Sinkronkan pathname untuk React Router SIBI sebelum bundle utama dieksekusi
        try {
          var expectedPath = ${JSON.stringify(cleanPath)};
          if (window.location.pathname !== expectedPath) {
            window.history.replaceState(null, '', expectedPath);
          }
        } catch(e) {
          console.warn('Gagal set history state:', e);
        }

        // 2. Pastikan file unduhan buku / PDF dan link eksternal dibuka di tab baru
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
      <style>
        /* Optimasi tampilan iframe agar rapi */
        body {
          overflow-x: hidden !important;
        }
      </style>
    `;

    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${injectionScript}`);
    } else {
      html = `${injectionScript}${html}`;
    }

    // Return HTML tanpa X-Frame-Options milik kemendikdasmen
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch (error) {
    console.error('Error proxying buku kemendikdasmen:', error);
    return new NextResponse('Terjadi kesalahan saat memuat Katalog Buku melalui proxy.', { status: 500 });
  }
}
