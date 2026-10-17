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

    // Suntikkan base href dan navigasi interceptor
    const injectionScript = `
      <base href="https://buku.kemendikdasmen.go.id/">
      <script type="text/javascript">
        // Intercept navigasi link agar tetap berada di dalam proxy SIAKAD
        document.addEventListener('click', function(e) {
          var a = e.target.closest('a');
          if (a && a.href) {
            try {
              var url = new URL(a.href, window.location.href);
              // Jika link masih dalam domain buku.kemendikdasmen.go.id
              if (url.hostname === 'buku.kemendikdasmen.go.id') {
                // Kecualikan link download file PDF langsung agar tetap bisa diunduh normal
                if (url.pathname.endsWith('.pdf') || url.pathname.includes('/download/')) {
                  return;
                }
                e.preventDefault();
                window.location.href = '/api/proxy-buku-kemendik?path=' + encodeURIComponent(url.pathname + url.search);
              }
            } catch(err) {}
          }
        }, true);
      </script>
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
