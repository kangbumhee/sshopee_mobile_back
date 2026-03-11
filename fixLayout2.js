const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');

// Change grid from 3 columns to 4
const count = (code.match(/repeat\(3,/g) || []).length;
code = code.replace(/repeat\(3,/g, 'repeat(4,');
console.log('Replaced repeat(3,) -> repeat(4,) count:', count);

fs.writeFileSync(file, code, 'utf8');
console.log('DONE');
