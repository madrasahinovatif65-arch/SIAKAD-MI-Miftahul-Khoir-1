const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
    const fileList = fs.readdirSync(dir);
    for (const file of fileList) {
        const name = dir + '/' + file;
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files);
        } else if (name.endsWith('.js')) {
            files.push(name);
        }
    }
    return files;
}

const files = getFiles('src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if the file contains the target string
    if (content.includes("new Date().toISOString().split('T')[0]")) {
        console.log('Modifying', file);
        
        // Add import if not present
        if (!content.includes('getTodayDate')) {
            if (content.includes("from '@/lib/dateUtils'")) {
                content = content.replace(/from '@\/lib\/dateUtils';/, ", getTodayDate } from '@/lib/dateUtils';");
                content = content.replace(/import { /, "import { getTodayDate, ");
            } else {
                content = "import { getTodayDate } from '@/lib/dateUtils';\n" + content;
            }
        }
        
        // Replace all instances
        content = content.replace(/new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g, 'getTodayDate()');
        
        fs.writeFileSync(file, content);
    }
});
