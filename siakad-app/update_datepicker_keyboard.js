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
    
    // Add readOnly and onFocus to DatePicker
    // Find <DatePicker withPortal={isMobile}
    // and replace with <DatePicker withPortal={isMobile} readOnly={isMobile} onFocus={(e) => isMobile && e.target.blur()}
    content = content.replace(/<DatePicker withPortal=\{isMobile\}(?! readOnly)/g, "<DatePicker withPortal={isMobile} readOnly={isMobile} onFocus={(e) => isMobile && e.target.blur()}");
    
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
