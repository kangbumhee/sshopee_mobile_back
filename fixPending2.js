const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');

// Fix label: 편딩중 -> 펜딩중
code = code.replace(/\uD3B8\uB529\uC911/g, '\uD3B8\uB529\uC911');
// Actually fix: find the PENDING entry and correct label
const pendingIdx = code.indexOf("key: 'PENDING'");
if (pendingIdx > 0) {
    const labelIdx = code.indexOf("label: '", pendingIdx);
    const labelEnd = code.indexOf("'", labelIdx + 8);
    const currentLabel = code.substring(labelIdx + 8, labelEnd);
    console.log('Current PENDING label:', currentLabel);
    code = code.substring(0, labelIdx + 8) + '펜딩중' + code.substring(labelEnd);
    console.log('1. PENDING label fixed to 펜딩중');
} else {
    console.log('1. PENDING not found');
}

// Fix grid to show 4 items per row
// Find the grid/flex container for status cards
const gridPatterns = [
    'grid-template-columns: repeat(3',
    'gridTemplateColumns: "repeat(3',
    'gridTemplateColumns: `repeat(3',
    'grid-template-columns: repeat(auto',
];

for (const p of gridPatterns) {
    if (code.includes(p)) {
        console.log('Found grid pattern:', p);
    }
}

// Search for the status rendering section
const statusMapIdx = code.indexOf('STATUS_CONFIG.map');
if (statusMapIdx > 0) {
    const before = code.substring(Math.max(0, statusMapIdx - 500), statusMapIdx);
    console.log('2. Before STATUS_CONFIG.map:', before.substring(before.length - 200));
}

fs.writeFileSync(file, code, 'utf8');
console.log('DONE');
