const fs = require('fs');
const file = 'C:\\Projects2\\shopee-web\\src\\app\\page.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix handleSaveGroup - close modal FIRST, then save
const oldSave = `const handleSaveGroup = async () => {
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
  };`;

const newSave = `const handleSaveGroup = async () => {
    if (!newGroupName.trim() || newGroupShops.length === 0) {
      alert('\uADF8\uB8F9 \uC774\uB984\uACFC \uC0F5\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.');
      return;
    }
    // Close modal immediately
    setShowGroupModal(false);
    const newGroups = [...shopGroupData.groups];
    if (editingGroup !== null) {
      newGroups[editingGroup] = { ...newGroups[editingGroup], name: newGroupName, shopIds: newGroupShops };
    } else {
      newGroups.push({ id: Date.now().toString(), name: newGroupName, shopIds: newGroupShops });
    }
    setShopGroupData(prev => ({ ...prev, groups: newGroups }));
    setNewGroupName('');
    setNewGroupShops([]);
    setEditingGroup(null);
    // Save to server
    if (user) {
      try { await saveShopGroups(user.uid, newGroups, shopGroupData.selectedGroupId); }
      catch(e) { console.error('Group save error:', e); }
    }
  };`;

code = code.replace(oldSave, newSave);
console.log('1. handleSaveGroup fixed (modal closes first)');

// 2. Fix handleSelectGroup - reload counts properly
const oldSelect = `const handleSelectGroup = async (groupId) => {
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
  };`;

const newSelect = `const handleSelectGroup = async (groupId) => {
    const newId = shopGroupData.selectedGroupId === groupId ? null : groupId;
    setShopGroupData(prev => ({ ...prev, selectedGroupId: newId }));
    setTotalCounts({});
    setSelectedStatus(null);
    setShopCounts([]);
    setExpandedShop(null);
    setShopOrders([]);
    setExpandedOrder(null);
    setOrderDetail(null);
    // Save to server
    if (user) {
      saveSelectedGroup(user.uid, newId).catch(e => console.error('Group select save error:', e));
    }
    // Reload counts with new group filter
    setCountsLoading(true);
    setRefreshStatus('\uC8FC\uBB38 \uD604\uD669 \uB85C\uB529\uC911...');
    try {
      const targetShops = newId
        ? shops.filter(s => { const g = shopGroupData.groups.find(g => g.id === newId); return g ? g.shopIds.includes(s.shop_id) : true; })
        : shops;
      const result = await shopeeApiProxy({
        action: 'getTotalCounts',
        params: { shopIds: targetShops.map(s => s.shop_id) }
      });
      setTotalCounts(result.data?.counts || {});
      setRefreshStatus('\uC644\uB8CC!');
      setTimeout(() => setRefreshStatus(''), 2000);
    } catch(e) {
      console.error('Counts load error:', e);
      setRefreshStatus('\uB85C\uB4DC \uC2E4\uD328');
      setTimeout(() => setRefreshStatus(''), 3000);
    } finally {
      setCountsLoading(false);
    }
  };`;

code = code.replace(oldSelect, newSelect);
console.log('2. handleSelectGroup fixed (reloads counts)');

// 3. Fix handleRefresh - always refresh ALL shops, not filtered
code = code.replace(
  `action: 'getTotalCounts',
        params: { forceRefresh: true, shopIds: filteredShops.map(s => s.shop_id) }`,
  `action: 'getTotalCounts',
        params: { forceRefresh: true }`
);
console.log('3. handleRefresh fixed (refreshes all shops)');

// 4. Fix handleDeleteGroup - save immediately
const oldDelete = `const handleDeleteGroup = async (idx) => {
    if (!confirm('\uC774 \uADF8\uB8F9\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
    const newGroups = shopGroupData.groups.filter((_, i) => i !== idx);
    const deletedId = shopGroupData.groups[idx]?.id;
    const newSelectedId = shopGroupData.selectedGroupId === deletedId ? null : shopGroupData.selectedGroupId;
    setShopGroupData({ groups: newGroups, selectedGroupId: newSelectedId });
    if (user) await saveShopGroups(user.uid, newGroups, newSelectedId);
    if (newSelectedId !== shopGroupData.selectedGroupId) loadTotalCounts();
  };`;

const newDelete = `const handleDeleteGroup = async (idx) => {
    if (!confirm('\uC774 \uADF8\uB8F9\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
    setShowGroupModal(false);
    const newGroups = shopGroupData.groups.filter((_, i) => i !== idx);
    const deletedId = shopGroupData.groups[idx]?.id;
    const newSelectedId = shopGroupData.selectedGroupId === deletedId ? null : shopGroupData.selectedGroupId;
    setShopGroupData({ groups: newGroups, selectedGroupId: newSelectedId });
    setEditingGroup(null);
    // Save to server immediately
    if (user) {
      try { await saveShopGroups(user.uid, newGroups, newSelectedId); }
      catch(e) { console.error('Group delete error:', e); }
    }
    if (newSelectedId !== shopGroupData.selectedGroupId) loadTotalCounts();
  };`;

code = code.replace(oldDelete, newDelete);
console.log('4. handleDeleteGroup fixed (saves immediately)');

// 5. After refresh, if a group is selected, reload with group filter
// Fix the refresh completion to reload with current group
const oldRefreshDone = `setTotalCounts(countsResult.data?.counts || {});
      setRefreshStatus('\uC644\uB8CC!');`;

const newRefreshDone = `const allCounts = countsResult.data?.counts || {};
      // If a group is selected, reload with group filter
      if (shopGroupData.selectedGroupId) {
        const targetShops = getFilteredShops();
        const groupResult = await shopeeApiProxy({
          action: 'getTotalCounts',
          params: { shopIds: targetShops.map(s => s.shop_id) }
        });
        setTotalCounts(groupResult.data?.counts || {});
      } else {
        setTotalCounts(allCounts);
      }
      setRefreshStatus('\uC644\uB8CC!');`;

code = code.replace(oldRefreshDone, newRefreshDone);
console.log('5. Refresh completion fixed (respects group filter)');

fs.writeFileSync(file, code, 'utf8');
console.log('\nDONE!');
