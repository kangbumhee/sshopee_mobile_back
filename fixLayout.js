const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');

// Find grid style for status cards and change to 4 columns
// Look for repeat(3 or repeat(auto patterns
const patterns = ['repeat(3,', 'repeat(3 ,', 'repeat(auto-fill', 'repeat(auto-fit'];
for (const p of patterns) {
    if (code.includes(p)) {
        console.log('Found pattern:', p);
    }
}

// Search around STATUS_CONFIG.map for grid styling
const mapIdx = code.indexOf('STATUS_CONFIG.map');
if (mapIdx > 0) {
    const region = code.substring(Math.max(0, mapIdx - 800), mapIdx + 200);
    // Find gridTemplateColumns or grid-template-columns
    const gridMatch = region.match(/grid[Tt]emplate[Cc]olumns['":\s]*[^;}'"]*/);
    if (gridMatch) {
        console.log('Grid found:', gridMatch[0]);
    }
    // Find display: grid or display:'grid'
    const displayMatch = region.match(/display['":\s]*['"]?grid/);
    if (displayMatch) {
        console.log('Display grid found');
    }
    console.log('Region around STATUS_CONFIG.map:', region.substring(region.length - 300));
}

fs.writeFileSync(file, code, 'utf8');
console.log('DONE - check output for grid patterns');
