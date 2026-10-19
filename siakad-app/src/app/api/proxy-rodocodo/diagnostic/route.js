import { NextResponse } from 'next/server';

/**
 * Diagnostic endpoint untuk troubleshoot Rodocodo loading issues
 * Access via: /api/proxy-rodocodo/diagnostic
 */
export async function GET() {
  const diagnosticResults = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Basic fetch dengan minimal headers
  try {
    console.log('🔍 Test 1: Basic fetch to Rodocodo...');
    const response1 = await fetch('https://www.rodocodo.com/free-coding-game-for-kids/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    diagnosticResults.tests.push({
      test: 'Basic Fetch',
      status: response1.status,
      statusText: response1.statusText,
      headers: Object.fromEntries(response1.headers.entries()),
      contentType: response1.headers.get('content-type'),
      xFrameOptions: response1.headers.get('x-frame-options'),
      csp: response1.headers.get('content-security-policy'),
      success: response1.ok
    });
  } catch (error) {
    diagnosticResults.tests.push({
      test: 'Basic Fetch',
      error: error.message,
      success: false
    });
  }

  // Test 2: Fetch dengan full browser headers
  try {
    console.log('🔍 Test 2: Full headers fetch...');
    const response2 = await fetch('https://www.rodocodo.com/free-coding-game-for-kids/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.rodocodo.com/',
        'Connection': 'keep-alive'
      }
    });

    const htmlPreview = await response2.text();
    
    diagnosticResults.tests.push({
      test: 'Full Headers Fetch',
      status: response2.status,
      statusText: response2.statusText,
      contentLength: htmlPreview.length,
      htmlPreview: htmlPreview.substring(0, 500),
      hasBaseTag: htmlPreview.includes('<base'),
      hasXFrameOptionsBlock: htmlPreview.toLowerCase().includes('x-frame-options'),
      success: response2.ok
    });
  } catch (error) {
    diagnosticResults.tests.push({
      test: 'Full Headers Fetch',
      error: error.message,
      success: false
    });
  }

  // Summary
  const allTestsPassed = diagnosticResults.tests.every(t => t.success);
  diagnosticResults.summary = {
    allPassed: allTestsPassed,
    totalTests: diagnosticResults.tests.length,
    passedTests: diagnosticResults.tests.filter(t => t.success).length,
    recommendation: allTestsPassed 
      ? 'Server responds OK. Issue might be X-Frame-Options or CSP blocking iframe.' 
      : 'Server is blocking requests. Check status codes and error messages.'
  };

  return NextResponse.json(diagnosticResults, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    }
  });
}
