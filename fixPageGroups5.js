const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');

// Fix: don't send empty shopIds array
const old1 = "params: { shopIds: filteredShops.map(s => Number(s.shop_id)) }";
const new1 = "params: filteredShops.length > 0 ? { shopIds: filteredShops.map(s => Number(s.shop_id)) } : {}";
if (code.includes(old1)) {
    code = code.replace(old1, new1);
    console.log('1. Fixed: empty shopIds no longer sent');
} else {
    console.log('1. Pattern not found, checking alternative...');
    // Try broader match
    const altOld = /params:\s*\{\s*shopIds:\s*filteredShops\.map\(s\s*=>\s*Number\(s\.shop_id\)\)\s*\}/;
    if (altOld.test(code)) {
        code = code.replace(altOld, "params: filteredShops.length > 0 ? { shopIds: filteredShops.map(s => Number(s.shop_id)) } : {}");
        console.log('1. Fixed with regex');
    } else {
        console.log('1. NOT FOUND - manual check needed');
    }
}

// Fix: getFilteredShops should return all shops when no group selected
const oldFilter = "const getFilteredShops = () => {";
const idx = code.indexOf(oldFilter);
if (idx !== -1) {
    // Find the function body end
    const funcStart = idx;
    let braceCount = 0;
    let funcEnd = -1;
    for (let i = code.indexOf('{', funcStart); i < code.length; i++) {
        if (code[i] === '{') braceCount++;
        if (code[i] === '}') braceCount--;
        if (braceCount === 0) { funcEnd = i + 1; break; }
    }
    if (funcEnd > 0) {
        const newFunc = `const getFilteredShops = () => {
    if (!selectedGroup || selectedGroup === 'all') return shops;
    const group = shopGroups.find(g => g.id === selectedGroup);
    if (!group) return shops;
    return shops.filter(s => group.shopIds.includes(Number(s.shop_id)));
  }`;
        code = code.substring(0, funcStart) + newFunc + code.substring(funcEnd);
        console.log('2. getFilteredShops fixed');
    }
} else {
    console.log('2. getFilteredShops not found');
}

fs.writeFileSync(file, code, 'utf8');
console.log('DONE!');
