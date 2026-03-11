const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');

// Fix getFilteredShops - compare as strings
const old1 = "return shops.filter(s => group.shopIds.includes(Number(s.shop_id)));";
const new1 = "return shops.filter(s => group.shopIds.includes(String(s.shop_id)));";
if (code.includes(old1)) {
    code = code.replace(old1, new1);
    console.log('1. getFilteredShops fixed (String comparison)');
} else {
    console.log('1. NOT FOUND');
}

// Fix handleSelectGroup - same issue
const old2 = "return g ? g.shopIds.includes(Number(s.shop_id)) : true;";
const new2 = "return g ? g.shopIds.includes(String(s.shop_id)) : true;";
if (code.includes(old2)) {
    code = code.replace(old2, new2);
    console.log('2. handleSelectGroup fixed (String comparison)');
} else {
    console.log('2. NOT FOUND');
}

// Fix: when filteredShops is 0 but group is selected, it should send empty result not ALL
const old3 = "shopIds being sent:', (((_fs.length > 0 && shopGroupData.selectedGroupId && shopGroupData.selectedGroupId !== 'all')";
if (code.includes(old3)) {
    console.log('3. Debug log found (ok)');
}

fs.writeFileSync(file, code, 'utf8');
console.log('DONE!');
