const fs = require('fs');
const files = [
  'src/components/JurnalPage.js',
  'src/components/PresensiPage.js',
  'src/components/RekapPage.js',
  'src/components/RiwayatGuruPage.js',
  'src/components/VerifikasiPage.js'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove the bad onFocus and readOnly
    // We will just use readOnly={isMobile} and remove the onFocus blur hack
    // Or better, to prevent keyboard without breaking onClick, we use readOnly={true} on the input
    // But since DatePicker might ignore readOnly click on some versions, let's use:
    // onFocus={(e) => { if (isMobile) e.target.readOnly = true; }}
    
    // First, let's remove the previous hack
    content = content.replace(/readOnly=\{isMobile\} onFocus=\{\(e\) => isMobile && e\.target\.blur\(\)\}/g, "onFocus={(e) => { if (isMobile) e.target.readOnly = true; }}");
    
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
