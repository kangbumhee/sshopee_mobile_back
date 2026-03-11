const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');

// Add debug log at start of loadTotalCounts
const old1 = "const loadTotalCounts = async () => {\n    setCountsLoading(true);";
const new1 = `const loadTotalCounts = async () => {
    const _fs = getFilteredShops();
    console.log('[DEBUG] loadTotalCounts called - filteredShops:', _fs.length, 'groupId:', shopGroupData.selectedGroupId, 'allShops:', shops.length);
    console.log('[DEBUG] shopIds being sent:', ((_fs.length > 0 && shopGroupData.selectedGroupId && shopGroupData.selectedGroupId !== 'all') ? _fs.map(s=>Number(s.shop_id)) : 'ALL'));
    setCountsLoading(true);`;

if (code.includes(old1)) {
    code = code.replace(old1, new1);
    console.log('1. Debug log added');
} else {
    // Try flexible match
    const idx = code.indexOf('const loadTotalCounts = async ()');
    if (idx >= 0) {
        const insertPoint = code.indexOf('setCountsLoading(true)', idx);
        if (insertPoint >= 0) {
            const debugCode = `const _fs = getFilteredShops();
    console.log('[DEBUG] loadTotalCounts - filteredShops:', _fs.length, 'groupId:', shopGroupData.selectedGroupId, 'shops:', shops.length);
    console.log('[DEBUG] shopIds:', ((_fs.length > 0 && shopGroupData.selectedGroupId && shopGroupData.selectedGroupId !== 'all') ? _fs.map(s=>Number(s.shop_id)) : 'ALL'));
    `;
            code = code.substring(0, insertPoint) + debugCode + code.substring(insertPoint);
            console.log('1. Debug log added (flexible)');
        }
    } else {
        console.log('1. NOT FOUND');
    }
}

fs.writeFileSync(file, code, 'utf8');
console.log('DONE!');
