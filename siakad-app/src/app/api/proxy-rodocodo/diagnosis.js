// Test Script: Diagnosis Rodocodo Loading Issues
// Run this in browser console or as standalone test

console.log('🔍 Starting Rodocodo Diagnosis...\n');

// Test 1: Direct iframe without proxy
console.log('TEST 1: Direct iframe (without proxy)');
const iframe1 = document.createElement('iframe');
iframe1.src = 'https://www.rodocodo.com/free-coding-game-for-kids/';
iframe1.style.width = '400px';
iframe1.style.height = '300px';
iframe1.onerror = (e) => console.error('❌ Direct iframe error:', e);
iframe1.onload = () => console.log('✅ Direct iframe loaded successfully');
// document.body.appendChild(iframe1);
console.log('Created test iframe (commented out to avoid cluttering page)');
console.log('Expected: X-Frame-Options or CSP blocking\n');

// Test 2: Fetch from proxy
console.log('TEST 2: Fetch via proxy endpoint');
fetch('/api/proxy-rodocodo?path=/free-coding-game-for-kids/')
  .then(response => {
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    return response.text();
  })
  .then(html => {
    console.log('✅ Proxy fetch successful');
    console.log('HTML length:', html.length);
    console.log('First 200 chars:', html.substring(0, 200));
  })
  .catch(error => {
    console.error('❌ Proxy fetch error:', error);
  });

// Test 3: Direct fetch to Rodocodo (will likely fail due to CORS)
console.log('\nTEST 3: Direct fetch to Rodocodo (expect CORS error)');
fetch('https://www.rodocodo.com/free-coding-game-for-kids/', { mode: 'no-cors' })
  .then(response => {
    console.log('Response (no-cors mode):', response);
    console.log('Note: no-cors mode hides actual response, but tells us if request went through');
  })
  .catch(error => {
    console.error('❌ Direct fetch error:', error);
  });

console.log('\n📊 Diagnosis complete. Check results above.');
