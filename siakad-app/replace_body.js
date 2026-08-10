const fs = require('fs');
let content = fs.readFileSync('e:\\OneDrive\\blogger.html', 'utf8');

const bodyStart = content.indexOf('<body');
const bodyEnd = content.indexOf('</body>');

if (bodyStart > -1 && bodyEnd > -1) {
  const newBody = `<body class="m-0 p-0 overflow-hidden w-screen h-screen">
    <iframe 
      src="https://siakad-app-phi.vercel.app/" 
      style="width: 100vw; height: 100vh; border: none; margin: 0; padding: 0; overflow: hidden; display: block;" 
      allow="geolocation; camera; microphone; fullscreen">
    </iframe>
`;
  
  content = content.substring(0, bodyStart) + newBody + content.substring(bodyEnd);
  fs.writeFileSync('e:\\OneDrive\\blogger.html', content, 'utf8');
  console.log('Replaced body successfully!');
} else {
  console.log('Could not find body tags. bodyStart:', bodyStart, 'bodyEnd:', bodyEnd);
}
