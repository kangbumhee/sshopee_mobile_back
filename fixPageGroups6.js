const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');
let fixed = 0;

// 1. First call (loadTotalCounts) - add empty check
const old1 = "params: { shopIds: filteredShops.map(s => s.shop_id) }";
const new1 = "params: (filteredShops.length > 0 && selectedGroup && selectedGroup !== 'all') ? { shopIds: filteredShops.map(s => Number(s.shop_id)) } : {}";
if (code.includes(old1)) {
    code = code.replace(old1, new1);
    console.log('1. loadTotalCounts fixed');
    fixed++;
}

// 2. Group reload after refresh - fix Number conversion
const old2 = "params: { shopIds: targetShops.map(s => s.shop_id) }";
while (code.includes(old2)) {
    code = code.replace(old2, "params: { shopIds: targetShops.map(s => Number(s.shop_id)) }");
    fixed++;
}
console.log('2. targetShops Number() conversions: ' + (fixed - 1));

// 3. Force refresh - make sure it refreshes ALL then filters client-side
const old3 = "params: { forceRefresh: true }";
// This one is fine - refreshes all shops

fs.writeFileSync(file, code, 'utf8');
console.log('Total fixes: ' + fixed);
console.log('DONE!');
