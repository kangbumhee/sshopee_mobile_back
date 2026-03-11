const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');

// Add PENDING after PROCESSED in STATUS_CONFIG
const old1 = "{ key: 'SHIPPED', label: '";
const idx = code.indexOf(old1);
if (idx > 0) {
    const pendingEntry = "{ key: 'PENDING', label: '\uD3B8\uB529\uC911', icon: '\u23F3', color: '#9c27b0' },\n  ";
    code = code.substring(0, idx) + pendingEntry + code.substring(idx);
    console.log('1. PENDING added to STATUS_CONFIG');
} else {
    console.log('1. NOT FOUND');
}

fs.writeFileSync(file, code, 'utf8');
console.log('DONE');
