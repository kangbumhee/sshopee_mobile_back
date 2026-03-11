const fs = require('fs');
const file = 'C:\\Projects2\\shopee-web\\src\\app\\page.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Remove loadTotalCounts calls from loadShops
code = code.replace(
  `setShops(shopList);
        setLoading(false);
        loadTotalCounts();`,
  `setShops(shopList);
        setLoading(false);`
);
code = code.replace(
  `if (!cached || cachedUid !== currentUid) loadTotalCounts();`,
  `// counts will be loaded after shopGroupData is ready`
);
console.log('1. Removed early loadTotalCounts calls from loadShops');

// 2. Add a useEffect that triggers loadTotalCounts when both shops AND shopGroupData are ready
const newEffect = `
  // Load counts when shops and group data are both ready
  useEffect(() => {
    if (shops.length > 0 && !loading) {
      loadTotalCounts();
    }
  }, [shops, shopGroupData.selectedGroupId, loading]);
`;

// Insert after the group load effect
code = code.replace(
  `// Load shop groups from Firestore
  useEffect(() => {
    if (user) {
      getShopGroups(user.uid).then(data => {
        setShopGroupData(data);
      }).catch(e => console.error('Group load error:', e));
    }
  }, [user]);`,
  `// Load shop groups from Firestore
  useEffect(() => {
    if (user) {
      getShopGroups(user.uid).then(data => {
        setShopGroupData(data);
      }).catch(e => console.error('Group load error:', e));
    }
  }, [user]);
${newEffect}`
);
console.log('2. Added useEffect for counts after group data ready');

fs.writeFileSync(file, code, 'utf8');
console.log('DONE!');
