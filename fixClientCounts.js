const fs = require('fs');
const file = 'C:/Projects2/shopee-web/src/app/page.js';
let code = fs.readFileSync(file, 'utf8');

const old1 = "action: 'getCountsByShop',\n        params: { orderStatus: statusKey }";
const new1 = `action: 'getCountsByShop',
        params: {
          orderStatus: statusKey,
          ...(shopGroupData.selectedGroupId && shopGroupData.selectedGroupId !== 'all'
            ? { shopIds: getFilteredShops().map(s => Number(s.shop_id)) }
            : {})
        }`;

if (code.includes(old1)) {
    code = code.replace(old1, new1);
    console.log('1. getCountsByShop shopIds added');
} else {
    console.log('1. NOT FOUND');
}

fs.writeFileSync(file, code, 'utf8');
console.log('DONE');
