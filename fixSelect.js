const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');

// Fix handleSelectGroup targetShops logic
const old1 = `const targetShops = newId
        ? shops.filter(s => { const g = shopGroupData.groups.find(g => g.id === newId); return g ? g.shopIds.includes(s.shop_id) : true; })
        : shops;
      const result = await shopeeApiProxy({
        action: 'getTotalCounts',
        params: { shopIds: targetShops.map(s => Number(s.shop_id)) }
      });`;

const new1 = `const targetShops = newId
        ? shops.filter(s => { const g = shopGroupData.groups.find(gg => gg.id === newId); return g ? g.shopIds.includes(Number(s.shop_id)) : true; })
        : shops;
      const result = await shopeeApiProxy({
        action: 'getTotalCounts',
        params: newId ? { shopIds: targetShops.map(s => Number(s.shop_id)) } : {}
      });`;

if (code.includes(old1)) {
    code = code.replace(old1, new1);
    console.log('1. handleSelectGroup fixed');
} else {
    console.log('1. NOT FOUND');
}

fs.writeFileSync(file, code, 'utf8');
console.log('DONE!');
