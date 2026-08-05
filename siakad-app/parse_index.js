const fs = require('fs');
const code = fs.readFileSync('g:\\\\My Drive\\\\INOVATIF\\\\ADMIN\\\\HUMAS\\\\SUPER APP\\\\Index.html', 'utf8');

const functionRegex = /function\s+([a-zA-Z0-9_]+)\s*\(/g;
let fMatch;
const functions = new Set();
while ((fMatch = functionRegex.exec(code)) !== null) {
  functions.add(fMatch[1]);
}
console.log('Functions:', Array.from(functions).join(', '));

const idRegex = /id="([a-zA-Z0-9_\-]+)"/g;
let iMatch;
const ids = new Set();
while ((iMatch = idRegex.exec(code)) !== null) {
  if (iMatch[1].startsWith('page-')) ids.add(iMatch[1]);
}
console.log('\nPage IDs:', Array.from(ids).join(', '));

const menus = new Set();
const navRegex = /onclick="[^"]*navigate[^"]*"/g;
let nMatch;
while ((nMatch = navRegex.exec(code)) !== null) {
  menus.add(nMatch[0]);
}
console.log('\nNavigations:', Array.from(menus).join(' | '));
