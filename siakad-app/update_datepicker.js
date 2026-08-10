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
    
    // Add import
    if (!content.includes('import { useIsMobile } from')) {
      content = content.replace("import DatePicker", "import { useIsMobile } from '@/hooks/useIsMobile';\nimport DatePicker");
    }
    
    // Add hook call
    if (!content.includes('const isMobile = useIsMobile();')) {
      content = content.replace(/(export default function \w+\(.*\) {)/, "$1\n  const isMobile = useIsMobile();");
    }
    
    // Add withPortal prop
    content = content.replace(/<DatePicker(?!\s+withPortal)/g, "<DatePicker withPortal={isMobile}");
    
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
