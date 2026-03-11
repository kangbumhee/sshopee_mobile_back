const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');
let fixed = 0;

// Replace all "selectedGroup" (standalone variable) with "shopGroupData.selectedGroupId"
// But NOT inside function declarations or shopGroupData itself
const replacements = [
    ["selectedGroup && selectedGroup !== 'all'", "shopGroupData.selectedGroupId && shopGroupData.selectedGroupId !== 'all'"],
    ["selectedGroup !== shopGroupData.selectedGroupId", null],
    ["newSelectedId !== shopGroupData.selectedGroupId", null],
];

// Fix loadTotalCounts params
const old1 = "(filteredShops.length > 0 && selectedGroup && selectedGroup !== 'all')";
const new1 = "(filteredShops.length > 0 && shopGroupData.selectedGroupId && shopGroupData.selectedGroupId !== 'all')";
if (code.includes(old1)) {
    code = code.replace(old1, new1);
    console.log('1. loadTotalCounts params fixed');
    fixed++;
}

// Find any remaining bare "selectedGroup" that should be shopGroupData.selectedGroupId
// Search for patterns like: selectedGroup === or selectedGroup !== or !selectedGroup
const patterns = [
    [/([^.])\bselectedGroup\b(?!\s*[=!<>])/g, null], // just log, don't replace blindly
];

// Check handleSelectGroup
const idx = code.indexOf('handleSelectGroup');
if (idx > 0) {
    const snippet = code.substring(idx, idx + 500);
    console.log('2. handleSelectGroup snippet:', snippet.substring(0, 300));
}

fs.writeFileSync(file, code, 'utf8');
console.log('Fixed: ' + fixed);
console.log('DONE!');
