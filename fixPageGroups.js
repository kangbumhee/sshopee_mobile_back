const fs = require('fs');
const file = 'C:\\Projects2\\shopee-web\\src\\app\\page.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Add import for shopGroups
code = code.replace(
  "import BottomNav from '../components/BottomNav';",
  `import BottomNav from '../components/BottomNav';
import { getShopGroups, saveShopGroups, saveSelectedGroup } from '../lib/shopGroups';`
);
console.log('1. Import added');

// 2. Add state variables after previewImages state
const stateInsert = `
  const [shopGroupData, setShopGroupData] = useState({ groups: [], selectedGroupId: null });
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupShops, setNewGroupShops] = useState([]);
  const [editingGroup, setEditingGroup] = useState(null);`;

code = code.replace(
  "const [previewImages, setPreviewImages] = useState(null);",
  `const [previewImages, setPreviewImages] = useState(null);
${stateInsert}`
);
console.log('2. State variables added');

// 3. Add useEffect to load groups after user loads
const groupLoadEffect = `
  // Load shop groups from Firestore
  useEffect(() => {
    if (user) {
      getShopGroups(user.uid).then(data => {
        setShopGroupData(data);
      }).catch(e => console.error('Group load error:', e));
    }
  }, [user]);
`;

code = code.replace(
  "useEffect(() => {\n    if (user) {\n      setupWakeLock();",
  `${groupLoadEffect}
  useEffect(() => {
    if (user) {
      setupWakeLock();`
);
console.log('3. Group load effect added');

// 4. Add helper functions before visibleStatuses
const helperFuncs = `
  // Get filtered shops based on selected group
  const getFilteredShops = () => {
    if (!shopGroupData.selectedGroupId) return shops;
    const group = shopGroupData.groups.find(g => g.id === shopGroupData.selectedGroupId);
    if (!group) return shops;
    return shops.filter(s => group.shopIds.includes(s.shop_id));
  };

  const filteredShops = getFilteredShops();
  const selectedGroup = shopGroupData.groups.find(g => g.id === shopGroupData.selectedGroupId);

  const handleSelectGroup = async (groupId) => {
    const newId = shopGroupData.selectedGroupId === groupId ? null : groupId;
    setShopGroupData(prev => ({ ...prev, selectedGroupId: newId }));
    setTotalCounts({});
    setSelectedStatus(null);
    setShopCounts([]);
    if (user) {
      await saveSelectedGroup(user.uid, newId);
      // Reload counts for filtered shops
      loadTotalCounts();
    }
  };

  const handleSaveGroup = async () => {
    if (!newGroupName.trim() || newGroupShops.length === 0) {
      alert('\uADF8\uB8F9 \uC774\uB984\uACFC \uC0F5\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.');
      return;
    }
    const newGroups = [...shopGroupData.groups];
    if (editingGroup !== null) {
      newGroups[editingGroup] = { ...newGroups[editingGroup], name: newGroupName, shopIds: newGroupShops };
    } else {
      newGroups.push({ id: Date.now().toString(), name: newGroupName, shopIds: newGroupShops });
    }
    setShopGroupData(prev => ({ ...prev, groups: newGroups }));
    if (user) await saveShopGroups(user.uid, newGroups, shopGroupData.selectedGroupId);
    setShowGroupModal(false);
    setNewGroupName('');
    setNewGroupShops([]);
    setEditingGroup(null);
  };

  const handleDeleteGroup = async (idx) => {
    if (!confirm('\uC774 \uADF8\uB8F9\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
    const newGroups = shopGroupData.groups.filter((_, i) => i !== idx);
    const deletedId = shopGroupData.groups[idx]?.id;
    const newSelectedId = shopGroupData.selectedGroupId === deletedId ? null : shopGroupData.selectedGroupId;
    setShopGroupData({ groups: newGroups, selectedGroupId: newSelectedId });
    if (user) await saveShopGroups(user.uid, newGroups, newSelectedId);
    if (newSelectedId !== shopGroupData.selectedGroupId) loadTotalCounts();
  };

  const openEditGroup = (idx) => {
    const g = shopGroupData.groups[idx];
    setNewGroupName(g.name);
    setNewGroupShops([...g.shopIds]);
    setEditingGroup(idx);
    setShowGroupModal(true);
  };

  const openNewGroup = () => {
    setNewGroupName('');
    setNewGroupShops([]);
    setEditingGroup(null);
    setShowGroupModal(true);
  };

  const toggleShopInGroup = (shopId) => {
    setNewGroupShops(prev => prev.includes(shopId) ? prev.filter(id => id !== shopId) : [...prev, shopId]);
  };
`;

code = code.replace(
  "const visibleStatuses = STATUS_CONFIG.filter",
  `${helperFuncs}
  const visibleStatuses = STATUS_CONFIG.filter`
);
console.log('4. Helper functions added');

// 5. Replace shop count display area - add group selector UI
// Find the "연결된 샵" section and add group UI after it
const shopListEndMarker = `{showShopList && (`;
const groupUI = `
      {/* \uADF8\uB8F9 \uC120\uD0DD UI */}
      {shopGroupData.groups.length > 0 && (
        <div style={{margin:'0 16px 8px',display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
          <div onClick={() => handleSelectGroup(null)}
            style={{padding:'6px 14px',borderRadius:20,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
              background:!shopGroupData.selectedGroupId?'#ee4d2d':'white',
              color:!shopGroupData.selectedGroupId?'white':'#333',
              border:!shopGroupData.selectedGroupId?'none':'1px solid #ddd'}}>
            \uC804\uCCB4 ({shops.length})
          </div>
          {shopGroupData.groups.map((g, idx) => (
            <div key={g.id} style={{display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
              <div onClick={() => handleSelectGroup(g.id)}
                style={{padding:'6px 14px',borderRadius:20,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',
                  background:shopGroupData.selectedGroupId===g.id?'#ee4d2d':'white',
                  color:shopGroupData.selectedGroupId===g.id?'white':'#333',
                  border:shopGroupData.selectedGroupId===g.id?'none':'1px solid #ddd'}}>
                {g.name} ({g.shopIds.length})
              </div>
              <span onClick={() => openEditGroup(idx)} style={{fontSize:10,cursor:'pointer',color:'#999'}}>\u270F\uFE0F</span>
            </div>
          ))}
          <div onClick={openNewGroup}
            style={{padding:'6px 14px',borderRadius:20,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
              background:'white',color:'#ee4d2d',border:'1px dashed #ee4d2d'}}>
            + \uADF8\uB8F9\uCD94\uAC00
          </div>
        </div>
      )}

      {shopGroupData.groups.length === 0 && (
        <div style={{margin:'0 16px 8px'}}>
          <div onClick={openNewGroup}
            style={{padding:'8px',borderRadius:8,fontSize:13,cursor:'pointer',textAlign:'center',
              background:'white',color:'#ee4d2d',border:'1px dashed #ee4d2d'}}>
            + \uC0F5 \uADF8\uB8F9 \uB9CC\uB4E4\uAE30
          </div>
        </div>
      )}

      `;

code = code.replace(shopListEndMarker, groupUI + shopListEndMarker);
console.log('5. Group UI added');

// 6. Add group modal before BottomNav
const groupModal = `
      {/* \uADF8\uB8F9 \uC0DD\uC131/\uC218\uC815 \uBAA8\uB2EC */}
      {showGroupModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={() => setShowGroupModal(false)}>
          <div style={{background:'white',borderRadius:16,padding:20,width:'90%',maxWidth:400,maxHeight:'80vh',overflowY:'auto'}}
            onClick={e => e.stopPropagation()}>
            <h3 style={{margin:'0 0 16px',fontSize:16}}>{editingGroup !== null ? '\uADF8\uB8F9 \uC218\uC815' : '\uC0C8 \uADF8\uB8F9 \uB9CC\uB4E4\uAE30'}</h3>
            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              placeholder="\uADF8\uB8F9 \uC774\uB984"
              style={{width:'100%',padding:12,border:'1px solid #ddd',borderRadius:8,fontSize:14,marginBottom:16,boxSizing:'border-box'}} />
            <div style={{fontSize:13,color:'#666',marginBottom:8}}>\uC0F5 \uC120\uD0DD ({newGroupShops.length}\uAC1C)</div>
            <div style={{maxHeight:300,overflowY:'auto'}}>
              {shops.map(s => (
                <div key={s.shop_id} onClick={() => toggleShopInGroup(s.shop_id)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderBottom:'1px solid #f0f0f0',cursor:'pointer',
                    background:newGroupShops.includes(s.shop_id)?'#fff0eb':'white'}}>
                  <div style={{width:22,height:22,borderRadius:4,border:newGroupShops.includes(s.shop_id)?'none':'2px solid #ddd',
                    background:newGroupShops.includes(s.shop_id)?'#ee4d2d':'white',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:14}}>
                    {newGroupShops.includes(s.shop_id) ? '\u2713' : ''}
                  </div>
                  <span style={{fontSize:13}}>{REGION_FLAGS[s.region]||''} {s.shop_name}</span>
                  {s.memo && <span style={{fontSize:10,color:'#999'}}>({s.memo})</span>}
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              {editingGroup !== null && (
                <button onClick={() => { handleDeleteGroup(editingGroup); setShowGroupModal(false); }}
                  style={{padding:'10px',background:'#f44336',color:'white',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>
                  \uC0AD\uC81C
                </button>
              )}
              <button onClick={() => setShowGroupModal(false)}
                style={{flex:1,padding:'10px',background:'#f0f0f0',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>
                \uCDE8\uC18C
              </button>
              <button onClick={handleSaveGroup}
                style={{flex:1,padding:'10px',background:'#ee4d2d',color:'white',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontWeight:'bold'}}>
                \uC800\uC7A5
              </button>
            </div>
          </div>
        </div>
      )}

`;

code = code.replace(
  "<BottomNav active=\"home\" />",
  `${groupModal}
      <BottomNav active="home" />`
);
console.log('6. Group modal added');

// 7. Update getTotalCounts to use filtered shops
// Add shopIds parameter to the API call
code = code.replace(
  `action: 'getTotalCounts',
        params: {}`,
  `action: 'getTotalCounts',
        params: { shopIds: filteredShops.map(s => s.shop_id) }`
);

// Also update the forceRefresh version
code = code.replace(
  `action: 'getTotalCounts',
        params: { forceRefresh: true }`,
  `action: 'getTotalCounts',
        params: { forceRefresh: true, shopIds: filteredShops.map(s => s.shop_id) }`
);
console.log('7. getTotalCounts updated with shopIds filter');

fs.writeFileSync(file, code, 'utf8');
console.log('\nDONE! All changes applied to page.js');
