const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');

const oldFunc = `const getFilteredShops = () => {
    if (!selectedGroup || selectedGroup === 'all') return shops;
    const group = shopGroups.find(g => g.id === selectedGroup);
    if (!group) return shops;
    return shops.filter(s => group.shopIds.includes(Number(s.shop_id)));
  }`;

const newFunc = `const getFilteredShops = () => {
    const gid = shopGroupData.selectedGroupId;
    if (!gid || gid === 'all') return shops;
    const group = shopGroupData.groups.find(g => g.id === gid);
    if (!group) return shops;
    return shops.filter(s => group.shopIds.includes(Number(s.shop_id)));
  }`;

if (code.includes(oldFunc)) {
    code = code.replace(oldFunc, newFunc);
    console.log('1. getFilteredShops fixed');
} else {
    console.log('1. NOT FOUND');
}

fs.writeFileSync(file, code, 'utf8');
console.log('DONE!');
