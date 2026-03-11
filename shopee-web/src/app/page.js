'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChange, getConnectedShops, shopeeApiProxy, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { playBGMIntro, playPowerUpSound } from '../lib/sounds';
import { setupWakeLock } from '../lib/wakeLock';
import BottomNav from '../components/BottomNav';
import { getShopGroups, saveShopGroups, saveSelectedGroup } from '../lib/shopGroups';

const REGION_FLAGS = {
  SG: '\uD83C\uDDF8\uD83C\uDDEC', MY: '\uD83C\uDDF2\uD83C\uDDFE', PH: '\uD83C\uDDF5\uD83C\uDDED', TH: '\uD83C\uDDF9\uD83C\uDDED', TW: '\uD83C\uDDF9\uD83C\uDDFC',
  VN: '\uD83C\uDDFB\uD83C\uDDF3', BR: '\uD83C\uDDE7\uD83C\uDDF7', MX: '\uD83C\uDDF2\uD83C\uDDFD', ID: '\uD83C\uDDEE\uD83C\uDDE9',
};

const getCurrency = (region) => {
  const map = { SG:'S$', MY:'RM', PH:'\u20B1', TH:'\u0E3F', TW:'NT$', VN:'\u20AB', BR:'R$', MX:'MX$', ID:'Rp' };
  return map[region] || '$';
};

const getCurrencyByRegion = (region) => {
  const map = {
    'SG': { symbol: 'S$', code: 'SGD' }, 'MY': { symbol: 'RM', code: 'MYR' }, 'TH': { symbol: '\u0E3F', code: 'THB' },
    'PH': { symbol: '\u20B1', code: 'PHP' }, 'TW': { symbol: 'NT$', code: 'TWD' }, 'VN': { symbol: '\u20AB', code: 'VND' },
    'BR': { symbol: 'R$', code: 'BRL' }, 'MX': { symbol: 'MX$', code: 'MXN' }, 'ID': { symbol: 'Rp', code: 'IDR' },
    'KR': { symbol: '\u20A9', code: 'KRW' },
  };
  return map[(region || '').toUpperCase()] || { symbol: '$', code: 'USD' };
};

const formatAmount = (amount, region) => {
  const curr = getCurrencyByRegion(region);
  const noDecimal = ['VND', 'KRW', 'IDR', 'TWD'];
  if (noDecimal.includes(curr.code)) {
    return curr.symbol + Math.floor(amount).toLocaleString();
  }
  return curr.symbol + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const STATUS_CONFIG = [
  { key: 'READY_TO_SHIP', label: '발송대기', icon: '\uD83D\uDCE6', color: '#e65100' },
  { key: 'PROCESSED', label: '처리중', icon: '\uD83D\uDE9A', color: '#f57c00' },
  { key: 'PENDING', label: '대기중', icon: '\u23F3', color: '#9c27b0' },
  { key: 'SHIPPED', label: '배송중', icon: '\uD83D\uDE9A', color: '#1565c0' },
  { key: 'COMPLETED', label: '완료', icon: '\u2705', color: '#2e7d32' },
  { key: 'IN_CANCEL', label: '취소/반품', icon: '\u274C', color: '#c62828' },
];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCounts, setTotalCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [shopCounts, setShopCounts] = useState([]);
  const [shopCountsLoading, setShopCountsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [expandedShop, setExpandedShop] = useState(null);
  const [shopOrders, setShopOrders] = useState([]);
  const [shopOrdersLoading, setShopOrdersLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderItemStocks, setOrderItemStocks] = useState({});
  const [previewImages, setPreviewImages] = useState(null);

  const [shopGroupData, setShopGroupData] = useState({ groups: [], selectedGroupId: null });
  const [shopGroupDataLoaded, setShopGroupDataLoaded] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupShops, setNewGroupShops] = useState([]);
  const [editingGroup, setEditingGroup] = useState(null); // { images: [{url, name, qty, option}], currentIndex: 0 }

  const [viewMode, setViewMode] = useState(null); // 'items' | 'shops' | null
  const [itemAggregation, setItemAggregation] = useState([]);
  const [itemAggLoading, setItemAggLoading] = useState(false);
  const [itemSortBy, setItemSortBy] = useState('name'); // 'quantity' | 'name' | 'amount'
  const [imageModal, setImageModal] = useState(null);
  const [purchaseRecords, setPurchaseRecords] = useState({});
  const [itemFilter, setItemFilter] = useState('all');
  const [inputQuantities, setInputQuantities] = useState({});
  const [shortageInputs, setShortageInputs] = useState({});

  const [salesData, setSalesData] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesExpanded, setSalesExpanded] = useState(false);
  const [animatedTotal, setAnimatedTotal] = useState(0);

  useEffect(() => {
    setShowCompleted(localStorage.getItem('shopee_show_completed') === 'true');
    setShowCancelled(localStorage.getItem('shopee_show_cancelled') === 'true');
  }, []);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      if (u) {
        const prevUid = localStorage.getItem('shopee_current_uid');
        if (prevUid && prevUid !== u.uid) {
          ['shopee_shops', 'shopee_show_completed', 'shopee_show_cancelled', 'shopee_chat_filter'].forEach(k => localStorage.removeItem(k));
          setShops([]);
          setTotalCounts({});
          setShopCounts([]);
          setSelectedStatus(null);
        }
        localStorage.setItem('shopee_current_uid', u.uid);
      }
      setUser(u);
      if (!u) router.push('/login');
    });
    return () => unsub();
  }, [router]);

  
  // Load shop groups from Firestore
  useEffect(() => {
    if (user) {
      getShopGroups(user.uid).then(data => {
        setShopGroupData(data);
        setShopGroupDataLoaded(true);
      }).catch(e => {
        console.error('Group load error:', e);
        setShopGroupDataLoaded(true); // 실패해도 로딩 완료로 처리
      });
    }
  }, [user]);

  // Load counts when shops and group data are both ready
  useEffect(() => {
    if (shops.length > 0 && !loading && shopGroupDataLoaded) {
      loadTotalCounts();
    }
  }, [shops, shopGroupData.selectedGroupId, loading, shopGroupDataLoaded]);

  useEffect(() => {
    if (shops.length > 0 && !loading && shopGroupDataLoaded) {
      loadSalesData();
    }
  }, [shops, loading, shopGroupData.selectedGroupId, shopGroupDataLoaded]);

  useEffect(() => {
    if (user) {
      setupWakeLock();
      playBGMIntro();
      const autoScan = localStorage.getItem('shopee_auto_scan');
      if (autoScan === 'true') { router.push('/scan'); return; }
      loadShops();
    }
  }, [user]);

  const loadShops = async () => {
    const currentUid = user?.uid;
    const cached = localStorage.getItem('shopee_shops');
    const cachedUid = localStorage.getItem('shopee_current_uid');
    let shopList = [];

    if (cached && cachedUid === currentUid) {
      try {
        shopList = JSON.parse(cached);
        setShops(shopList);
        setLoading(false);
      } catch (e) {}
    } else {
      localStorage.removeItem('shopee_shops');
    }

    try {
      const result = await getConnectedShops();
      shopList = result.data?.shops || [];
      setShops(shopList);
      localStorage.setItem('shopee_shops', JSON.stringify(shopList));
    } catch (e) {
      console.error('샵 로드 실패:', e);
    } finally {
      setLoading(false);
    }
    // counts will be loaded after shopGroupData is ready
    setTimeout(() => {
      shopeeApiProxy({ action: 'buildTrackingIndex', params: {} }).catch(() => {});
    }, 5000);
  };

  const EXCHANGE_RATES = {
    SGD: 1080, MYR: 315, THB: 40, PHP: 25, TWD: 45,
    VND: 0.058, BRL: 260, MXN: 72, IDR: 0.088, KRW: 1, USD: 1450
  };

  const getExchangeRates = () => {
    try {
      const cached = localStorage.getItem('shopee_exchange_rates');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < 24 * 3600 * 1000) return parsed.rates;
      }
    } catch (e) {}
    return EXCHANGE_RATES;
  };

  const toKRW = (amount, currency) => {
    if (!currency || currency === 'KRW') return amount;
    const rates = getExchangeRates();
    return amount * (rates[currency] || 1450);
  };

  const loadSalesData = async () => {
    setSalesLoading(true);
    try {
      const { getFirestore, collection, getDocs, query, where } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      const firestore = getFirestore();
      const uid = getAuth().currentUser?.uid;
      if (!uid) { setSalesLoading(false); return; }

      // 환율 업데이트 (백그라운드, 1일 캐시)
      try {
        const cached = localStorage.getItem('shopee_exchange_rates');
        const needUpdate = !cached || (Date.now() - JSON.parse(cached).ts > 24 * 3600 * 1000);
        if (needUpdate) {
          fetch('https://api.exchangerate-api.com/v4/latest/USD').then(r => r.json()).then(data => {
            if (data.rates) {
              const rates = {};
              const krwRate = data.rates['KRW'] || 1450;
              Object.keys(data.rates).forEach(k => { rates[k] = krwRate / data.rates[k]; });
              rates['KRW'] = 1;
              localStorage.setItem('shopee_exchange_rates', JSON.stringify({ rates, ts: Date.now() }));
            }
          }).catch(() => {});
        }
      } catch (e) {}

      // KST 시간 계산
      const now = Math.floor(Date.now() / 1000);
      const kstNow = now + 9 * 3600;
      const kstMidnight = kstNow - (kstNow % 86400);
      const todayStartUTC = kstMidnight - 9 * 3600;
      const yesterdayStartUTC = todayStartUTC - 86400;
      const recent7Start = todayStartUTC - 7 * 86400;
      const prev7Start = recent7Start - 7 * 86400;
      const recent30Start = todayStartUTC - 30 * 86400;
      const prev30Start = recent30Start - 30 * 86400;

      // 그룹 필터
      const filteredShops = getFilteredShops();
      const gid = shopGroupData.selectedGroupId;
      const targetShopIds = (gid && gid !== 'all')
        ? filteredShops.map(s => String(s.shop_id))
        : null;

      const shopMap = {};
      const totals = { today: 0, yesterday: 0, recent7: 0, prev7: 0, recent30: 0, prev30: 0 };

      // rangeType: 'recent' | 'week' | 'month'
      // recent = 오늘+어제, week = 2일~7일 전, month = 7일~30일 전
      const processOrders = (snap, rangeType = 'recent') => {
        snap.forEach(doc => {
          const o = doc.data();
          const shopId = String(o.shop_id);
          if (targetShopIds && !targetShopIds.includes(shopId)) return;
          const ct = o.create_time || 0;
          const amt = toKRW(Number(o.total_amount) || 0, o.currency);
          if (!shopMap[shopId]) {
            shopMap[shopId] = {
              shop_id: shopId, region: (o.region || '').toUpperCase(), currency: o.currency || '',
              shop_name: '', memo: '', today: 0, yesterday: 0, recent7: 0, prev7: 0, recent30: 0, prev30: 0
            };
          }
          const sm = shopMap[shopId];

          if (rangeType === 'recent') {
            // 오늘
            if (ct >= todayStartUTC && ct <= now) { sm.today += amt; totals.today += amt; }
            // 어제
            if (ct >= yesterdayStartUTC && ct < todayStartUTC) { sm.yesterday += amt; totals.yesterday += amt; }
            // recent7, recent30 에도 포함 (오늘+어제도 7일/30일 범위)
            if (ct >= recent7Start && ct <= now) { sm.recent7 += amt; totals.recent7 += amt; }
            if (ct >= recent30Start && ct <= now) { sm.recent30 += amt; totals.recent30 += amt; }
          }

          if (rangeType === 'week') {
            // 2일~7일 전 구간 (오늘+어제 제외, prev7도 포함)
            if (ct >= recent7Start && ct < yesterdayStartUTC) { sm.recent7 += amt; totals.recent7 += amt; }
            if (ct >= prev7Start && ct < recent7Start) { sm.prev7 += amt; totals.prev7 += amt; }
            // recent30 에도 포함
            if (ct >= recent30Start && ct < yesterdayStartUTC) { sm.recent30 += amt; totals.recent30 += amt; }
          }

          if (rangeType === 'month') {
            // 7일~30일 전 구간
            if (ct >= prev30Start && ct < prev7Start) { sm.prev30 += amt; totals.prev30 += amt; }
            // recent30 에도 포함
            if (ct >= recent30Start && ct < prev7Start) { sm.recent30 += amt; totals.recent30 += amt; }
          }
        });
      };

      // 1단계: 오늘+어제 (2일치, 빠르게)
      const recentSnap = await getDocs(
        query(collection(firestore, 'users', uid, 'orders'), where('create_time', '>=', yesterdayStartUTC))
      );
      processOrders(recentSnap, 'recent');

      // 먼저 오늘+어제 결과 표시
      const earlyTotals = { ...totals };
      Object.keys(earlyTotals).forEach(k => { earlyTotals[k] = Math.round(earlyTotals[k]); });
      const earlyShops = Object.values(shopMap).map(sm => {
        const found = (shops || []).find(s => String(s.shop_id) === sm.shop_id);
        if (found) { sm.shop_name = found.shop_name || found.name || sm.shop_id; sm.memo = found.memo || found.note || ''; }
        else { sm.shop_name = sm.shop_id; }
        return { ...sm, today: Math.round(sm.today), yesterday: Math.round(sm.yesterday),
          recent7: Math.round(sm.recent7), prev7: Math.round(sm.prev7),
          recent30: Math.round(sm.recent30), prev30: Math.round(sm.prev30) };
      });
      setSalesData({ totals: earlyTotals, shops: earlyShops });

      // 카운트업 애니메이션
      const target = earlyTotals.today;
      let step = 0;
      const steps = 40;
      const timer = setInterval(() => {
        step++;
        const eased = 1 - Math.pow(1 - step / steps, 3);
        setAnimatedTotal(Math.round(target * eased));
        if (step >= steps) clearInterval(timer);
      }, 1500 / steps);

      // 2단계: 7일+30일 데이터 (백그라운드, 캐시 활용)
      const cacheKey = `sales_weekly_monthly_${uid}_${gid || 'all'}`;
      const salesCache = localStorage.getItem(cacheKey);
      let usedCache = false;

      if (salesCache) {
        try {
          const c = JSON.parse(salesCache);
          // 캐시가 1시간 이내면 사용
          if (Date.now() - c.ts < 3600 * 1000) {
            totals.recent7 = c.totals.recent7; totals.prev7 = c.totals.prev7;
            totals.recent30 = c.totals.recent30; totals.prev30 = c.totals.prev30;
            // 샵별 데이터도 복원
            (c.shops || []).forEach(cs => {
              if (targetShopIds && !targetShopIds.includes(String(cs.shop_id))) return;
              if (!shopMap[cs.shop_id]) {
                // 오늘/어제 주문이 없던 샵도 새로 생성
                shopMap[cs.shop_id] = {
                  shop_id: String(cs.shop_id),
                  region: '', currency: '', shop_name: '', memo: '',
                  today: 0, yesterday: 0,
                  recent7: 0, prev7: 0, recent30: 0, prev30: 0,
                };
              }
              shopMap[cs.shop_id].recent7 = cs.recent7;
              shopMap[cs.shop_id].prev7 = cs.prev7;
              shopMap[cs.shop_id].recent30 = cs.recent30;
              shopMap[cs.shop_id].prev30 = cs.prev30;
            });
            usedCache = true;
          }
        } catch (e) {}
      }

      if (!usedCache) {
        try {
          // 7일 데이터 (오늘+어제 제외한 나머지)
          const week7Snap = await getDocs(
            query(collection(firestore, 'users', uid, 'orders'),
              where('create_time', '>=', prev7Start),
              where('create_time', '<', yesterdayStartUTC))
          );
          processOrders(week7Snap, 'week');

          // 30일 데이터 (위에서 읽은 범위 제외)
          const month30Snap = await getDocs(
            query(collection(firestore, 'users', uid, 'orders'),
              where('create_time', '>=', prev30Start),
              where('create_time', '<', prev7Start))
          );
          processOrders(month30Snap, 'month');

          // cache save
          const cacheData = {
            ts: Date.now(),
            totals: { recent7: totals.recent7, prev7: totals.prev7, recent30: totals.recent30, prev30: totals.prev30 },
            shops: Object.values(shopMap).map(sm => ({
              shop_id: sm.shop_id, recent7: sm.recent7, prev7: sm.prev7, recent30: sm.recent30, prev30: sm.prev30
            }))
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
          console.log('주간/월간 로드 실패 (캐시 사용):', e.message);
        }
      }

          // 최종 결과 업데이트
      Object.keys(totals).forEach(k => { totals[k] = Math.round(totals[k]); });
      const shopResults = Object.values(shopMap).map(sm => {
        const found = (shops || []).find(s => String(s.shop_id) === sm.shop_id);
        if (found) { sm.shop_name = found.shop_name || found.name || sm.shop_id; sm.memo = found.memo || found.note || ''; }
        else { sm.shop_name = sm.shop_id; }
        return { ...sm, today: Math.round(sm.today), yesterday: Math.round(sm.yesterday),
          recent7: Math.round(sm.recent7), prev7: Math.round(sm.prev7),
          recent30: Math.round(sm.recent30), prev30: Math.round(sm.prev30) };
      });
      setSalesData({ totals, shops: shopResults });

    } catch (e) {
      console.log('매출 로드 실패:', e.message);
    }
    setSalesLoading(false);
  };

  const loadTotalCounts = async () => {
    setCountsLoading(true);
    setRefreshStatus('주문 현황 로딩중..');
    const startTime = Date.now();
    const filteredShops = getFilteredShops();
    const gid = shopGroupData.selectedGroupId;
    try {
      const { getFirestore, collection, getDocs } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      const firestore = getFirestore();
      const auth = getAuth();
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) { setCountsLoading(false); return; }
      const countsSnap = await getDocs(collection(firestore, 'users', currentUid, 'orderCounts'));

      const allCounts = {};
      const STATUSES = ['READY_TO_SHIP', 'PROCESSED', 'SHIPPED', 'COMPLETED', 'IN_CANCEL', 'PENDING'];
      STATUSES.forEach(s => { allCounts[s] = 0; });

      const targetShopIds = (gid && gid !== 'all') ? filteredShops.map(s => String(s.shop_id)) : null;

      countsSnap.forEach(doc => {
        const data = doc.data();
        const shopId = String(doc.id);
        if (targetShopIds && !targetShopIds.includes(shopId)) return;
        STATUSES.forEach(s => { allCounts[s] += (data[s] || 0); });
        allCounts['IN_CANCEL'] += (data['CANCELLED'] || 0);
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      setTotalCounts(allCounts);
      setRefreshStatus('주문 현황 로딩 완료 (' + elapsed + '초)');
      setTimeout(() => setRefreshStatus(''), 3000);

      const bgUpdate = async () => {
        try {
          const { getFirestore, collection, getDocs } = await import('firebase/firestore');
          const fdbInit = getFirestore();
          const bgUid = (await import('firebase/auth')).getAuth().currentUser?.uid;
          const cSnapInit = bgUid ? await getDocs(collection(fdbInit, 'users', bgUid, 'orderCounts')) : { forEach: () => {} };
          const initShopIds = new Set((filteredShops || shops).map(s => String(s.shop_id)));
          const initCounts = { READY_TO_SHIP: 0, PROCESSED: 0, SHIPPED: 0, COMPLETED: 0, IN_CANCEL: 0, PENDING: 0 };
          cSnapInit.forEach(d => {
            const v = d.data();
            const shopId = String(d.id); // doc.id 기준으로 통일
            if (initShopIds.has(shopId)) {
              ['READY_TO_SHIP', 'PROCESSED', 'SHIPPED', 'COMPLETED', 'IN_CANCEL', 'PENDING'].forEach(k => { initCounts[k] += (v[k] || 0); });
              initCounts.IN_CANCEL += (v['CANCELLED'] || 0);
            }
          });
          setTotalCounts(initCounts);
          const bgElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          setRefreshStatus('실시간 갱신 완료 (' + bgElapsed + '초)');
          setTimeout(() => setRefreshStatus(''), 3000);
        } catch (e) {
          console.log('백그라운드 갱신 실패:', e.message);
        }
      };

      const total = Object.values(allCounts).reduce((a, b) => a + b, 0);
      if (total === 0 && countsSnap.size === 0) {
        setRefreshStatus('주문 데이터 초기화 중.. (최초 1회 2~3분 필요)');
        try {
          const initFn = httpsCallable(functions, 'initOrderCounts', { timeout: 300000 });
          await initFn({});
          const countsSnap2 = await getDocs(collection(firestore, 'users', currentUid, 'orderCounts'));
          const newCounts = {};
          STATUSES.forEach(s => { newCounts[s] = 0; });
          countsSnap2.forEach(doc => {
            const data = doc.data();
            const shopId = String(doc.id);
            if (targetShopIds && !targetShopIds.includes(shopId)) return;
            STATUSES.forEach(s => { newCounts[s] += (data[s] || 0); });
            newCounts['IN_CANCEL'] += (data['CANCELLED'] || 0);
          });
          setTotalCounts(newCounts);
      setRefreshStatus('초기화 완료');
          setTimeout(() => setRefreshStatus(''), 3000);
        } catch (e) {
          console.log('초기화 실패, API fallback:', e.message);
          bgUpdate();
        }
      } else {
        bgUpdate();
      }
    } catch (e) {
      console.error('카운트 로드 실패:', e);
      setRefreshStatus('주문 현황 로딩 실패');
      setTimeout(() => setRefreshStatus(''), 3000);
    } finally {
      setCountsLoading(false);
    }
  };

  const handleOrderClick = async (order, shopId) => {
    if (expandedOrder === order.order_sn) { setExpandedOrder(null); setOrderDetail(null); return; }
    setExpandedOrder(order.order_sn);
    setOrderDetail(null);
    setOrderDetailLoading(true);
    setOrderItemStocks({});
    try {
      const result = await shopeeApiProxy({
        action: 'getOrderDetail',
        shopId,
        params: { orderSnList: [order.order_sn] }
      });
      const orderList = result.data?.response?.order_list || [];
      if (orderList.length > 0) {
        const detail = orderList[0];
        setOrderDetail(detail);
        const itemIds = [...new Set((detail.item_list || []).map(i => i.item_id))];
        if (itemIds.length > 0) {
          const stockResult = await shopeeApiProxy({ action: 'getItemBaseInfo', shopId, params: { itemIds } });
          const items = stockResult.data?.items || [];
          const stocks = {};
          items.forEach(item => {
            if (item.stock_info_v2?.summary_info) stocks[item.item_id] = { total: item.stock_info_v2.summary_info.total_available_stock || 0 };
            if (item.model_list) item.model_list.forEach(m => { stocks[`${item.item_id}_${m.model_id}`] = { stock: m.stock_info_v2?.summary_info?.total_available_stock ?? m.normal_stock ?? 0 }; });
          });
          setOrderItemStocks(stocks);
        }
      }
      } catch (e) { console.error('상세 로드 실패:', e); }
    finally { setOrderDetailLoading(false); }
  };

  const openImagePreview = (items, clickedIndex = 0) => {
    const images = (items || []).map(item => ({
      url: item.image_info?.image_url || '',
      name: item.item_name || '',
      qty: item.model_quantity_purchased || item.quantity || 1,
      option: item.model_name || '',
    })).filter(img => img.url);
    if (images.length > 0) setPreviewImages({ images, currentIndex: clickedIndex });
  };

  const loadPurchaseRecords = async () => {
    try {
      const { getFirestore, collection, getDocs } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      const firestore = getFirestore();
      const uid = getAuth().currentUser?.uid;
      if (!uid) return {};
      const snap = await getDocs(collection(firestore, 'users', uid, 'purchaseRecords'));
      const records = {};
      snap.forEach(doc => { records[doc.id] = doc.data(); });
      setPurchaseRecords(records);
      return records;
    } catch (e) {
      console.log('구매기록 로드 실패:', e.message);
      return {};
    }
  };

  const savePurchaseRecord = async (itemKey, data) => {
    try {
      const { getFirestore, doc, setDoc } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      const firestore = getFirestore();
      const uid = getAuth().currentUser?.uid;
      if (!uid) return;
      await setDoc(doc(firestore, 'users', uid, 'purchaseRecords', itemKey), data, { merge: true });
      setPurchaseRecords(prev => ({ ...prev, [itemKey]: { ...(prev[itemKey] || {}), ...data } }));
    } catch (e) {
      console.log('구매기록 ????ㅽ뙣:', e.message);
    }
  };

  const loadItemAggregation = async (statusKey) => {
    console.log('AAA loadItemAggregation 호출됨', statusKey);
    setItemAggLoading(true);
    setItemAggregation([]);
    setInputQuantities({});
    setShortageInputs({});
    try {
      const { getFirestore, collection, getDocs, query, where } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      const firestore = getFirestore();
      const uid = getAuth().currentUser?.uid;
      if (!uid) { setItemAggLoading(false); return; }

      const filteredShops = getFilteredShops();
      const targetShopIds = (shopGroupData.selectedGroupId && shopGroupData.selectedGroupId !== 'all')
        ? filteredShops.map(s => String(s.shop_id))
        : null;

      let statuses = [statusKey];
      if (statusKey === 'IN_CANCEL') statuses = ['IN_CANCEL', 'CANCELLED'];

      // 1단계: 기존 방식으로 item_id + model_id + region 별 집계
      const rawMap = {};
      for (const st of statuses) {
        const q = query(
          collection(firestore, 'users', uid, 'orders'),
          where('order_status', '==', st)
        );
        const snap = await getDocs(q);
        snap.forEach(doc => {
          const order = doc.data();
          const shopId = String(order.shop_id);
          if (targetShopIds && !targetShopIds.includes(shopId)) return;
          const region = (order.region || '').toUpperCase();
          const items = order.item_list || [];
          items.forEach(item => {
            const key = `${item.item_id}_${item.model_id || 'nomodel'}_${region}`;
            if (!rawMap[key]) {
              rawMap[key] = {
                itemKey: `${item.item_id}_${item.model_id || 'nomodel'}`,
                item_id: item.item_id,
                model_id: item.model_id || '',
                item_name: item.item_name || item.name || '?곹뭹紐??놁쓬',
                model_name: item.model_name || '',
                model_sku: item.model_sku || item.item_sku || '',
                image_url: (item.image_info && item.image_info.image_url) ? item.image_info.image_url : (item.image_url || ''),
                region: region,
                currency: getCurrencyByRegion(region),
                totalQuantity: 0,
                totalAmount: 0,
                totalAmountKRW: 0,
                orderCount: 0,
              };
            }
            const qty = item.model_quantity_purchased || item.quantity || 1;
            const price = item.model_discounted_price || item.model_original_price || 0;
            rawMap[key].totalQuantity += qty;
            rawMap[key].totalAmount += price * qty;
            rawMap[key].totalAmountKRW += toKRW(price * qty, order.currency || '');
            rawMap[key].orderCount += 1;
          });
        });
      }

      // 2단계: 같은 model_sku끼리 표시용으로 묶기
      const skuGroupMap = {};
      const noSkuItems = [];

      Object.values(rawMap).forEach(item => {
        if (item.model_sku) {
          if (!skuGroupMap[item.model_sku]) {
            skuGroupMap[item.model_sku] = {
              itemKey: item.model_sku,
              displayKey: item.model_sku,
              item_id: item.item_id,
              model_id: item.model_id,
              item_name: item.item_name,
              model_name: item.model_name,
              model_sku: item.model_sku,
              image_url: item.image_url,
              region: item.region,
              regions: [item.region],
              currency: item.currency,
              totalQuantity: 0,
              totalAmount: 0,
              totalAmountKRW: 0,
              orderCount: 0,
              subItems: [],
            };
          }
          const group = skuGroupMap[item.model_sku];
          group.totalQuantity += item.totalQuantity;
          group.totalAmount += item.totalAmount;
          group.totalAmountKRW += item.totalAmountKRW;
          group.orderCount += item.orderCount;
          group.subItems.push(item);
          if (!group.regions.includes(item.region)) {
            group.regions.push(item.region);
          }
          if (!group.image_url && item.image_url) {
            group.image_url = item.image_url;
          }
        } else {
          noSkuItems.push({
            ...item,
            displayKey: item.itemKey + '_' + item.region,
            regions: [item.region],
            totalAmountKRW: item.totalAmountKRW,
            model_sku: '',
            subItems: [item],
          });
        }
      });

      const items = [...Object.values(skuGroupMap), ...noSkuItems];
      console.log('SKU집계결과:', items.map(i=>({name:i.item_name,sku:i.model_sku,regions:i.regions,subCount:i.subItems?.length}))); setItemAggregation(items);

      // 3단계: 구매기록 로드 + 배송중 전환 자동 차감
      const records = await loadPurchaseRecords();
      if (statusKey === 'PROCESSED') {
        const updates = {};
        items.forEach(item => {
          // SKU 그룹은 subItems의 각 itemKey별로 체크
          (item.subItems || []).forEach(sub => {
            const record = records[sub.itemKey];
            if (!record || !record.procQty || record.procQty <= 0) return;
            if (record.procTargetCount && record.procTargetCount > 0) {
              const currentCount = sub.totalQuantity;
              if (currentCount < record.procTargetCount) {
                const diff = record.procTargetCount - currentCount;
                const newQty = Math.max(0, record.procQty - diff);
                updates[sub.itemKey] = {
                  procQty: newQty,
                  procTargetCount: currentCount,
                  updatedAt: new Date().toISOString()
                };
              }
            }
          });
        });
        for (const [key, data] of Object.entries(updates)) {
          await savePurchaseRecord(key, data);
        }
      }
    } catch (e) {
      console.error('품목 집계 실패:', e);
    }
    setItemAggLoading(false);
  };

  const getFilteredAndSortedItems = () => {
    let items = [...itemAggregation];
    if (itemFilter === 'ordered') {
      items = items.filter(i => isItemOrdered(i));
    } else if (itemFilter === 'notOrdered') {
      items = items.filter(i => !isItemOrdered(i));
    }
    if (itemSortBy === 'quantity') items.sort((a, b) => b.totalQuantity - a.totalQuantity);
    else if (itemSortBy === 'name') items.sort((a, b) => a.item_name.localeCompare(b.item_name));
    else if (itemSortBy === 'amount') items.sort((a, b) => b.totalAmount - a.totalAmount);
    return items;
  };

  const handleQtyAdd = (itemKey, amount) => {
    setInputQuantities(prev => ({ ...prev, [itemKey]: (prev[itemKey] || 0) + amount }));
  };

  const handleQtyReset = (itemKey) => {
    setInputQuantities(prev => ({ ...prev, [itemKey]: 0 }));
  };

    // 구매수량 확정
  const handleQtyConfirm = async (item) => {
    const qty = inputQuantities[item.itemKey || item.displayKey] || 0;
    if (qty <= 0) return;
    const currentStatus = selectedStatus;
    // subItems 중 첫번째의 itemKey 사용 (기존 키 호환)
    const targetKey = (item.subItems && item.subItems.length > 0) ? item.subItems[0].itemKey : item.itemKey;
    const data = {
      updatedAt: new Date().toISOString(),
      item_id: String(item.item_id), model_id: String(item.model_id || ''),
      item_name: item.item_name, model_name: item.model_name || '', image_url: item.image_url || ''
    };
    if (currentStatus === 'READY_TO_SHIP') {
      const existing = purchaseRecords[targetKey]?.rtsQty || 0;
      data.rtsQty = existing + qty;
      data.rtsTargetCount = item.totalQuantity;
    } else if (currentStatus === 'PROCESSED') {
      const existing = purchaseRecords[targetKey]?.procQty || 0;
      data.procQty = existing + qty;
      data.procTargetCount = item.totalQuantity;
    }
    await savePurchaseRecord(targetKey, data);
    setInputQuantities(prev => ({ ...prev, [item.itemKey || item.displayKey]: 0 }));
  };

    // 구매수량 직접 수정
  const handleQtyEdit = async (item, field) => {
    const targetKey = (item.subItems && item.subItems.length > 0) ? item.subItems[0].itemKey : item.itemKey;
    const rec = purchaseRecords[targetKey] || {};
    const current = field === 'rts' ? (rec.rtsQty || 0) : (rec.procQty || 0);
    const newVal = prompt((field === 'rts' ? '발송대기' : '처리중') + ' 구매수량 수정 (현재: ' + current + ')', String(current));
    if (newVal === null) return;
    const num = parseInt(newVal);
    if (isNaN(num) || num < 0) return;
    const data = { updatedAt: new Date().toISOString() };
    if (field === 'rts') { data.rtsQty = num; } else { data.procQty = num; }
    await savePurchaseRecord(targetKey, data);
  };

    // 재고보유 토글
  const handleStockToggle = async (item) => {
    const targetKey = (item.subItems && item.subItems.length > 0) ? item.subItems[0].itemKey : item.itemKey;
    const rec = purchaseRecords[targetKey] || {};
    const data = { hasStock: !rec.hasStock, updatedAt: new Date().toISOString() };
    await savePurchaseRecord(targetKey, data);
  };

  const handleShortageAdd = (itemKey) => {
    setShortageInputs(prev => ({ ...prev, [itemKey]: (prev[itemKey] || 0) + 1 }));
  };

  const handleShortageConfirm = async (item) => {
    const qty = shortageInputs[item.itemKey || item.displayKey] || 0;
    if (qty <= 0) return;
    const targetKey = (item.subItems && item.subItems.length > 0) ? item.subItems[0].itemKey : item.itemKey;
    const existing = purchaseRecords[targetKey]?.shortage || 0;
    await savePurchaseRecord(targetKey, {
      shortage: existing + qty,
      updatedAt: new Date().toISOString(),
      item_id: String(item.item_id), model_id: String(item.model_id || ''),
      item_name: item.item_name, model_name: item.model_name || '', image_url: item.image_url || ''
    });
    setShortageInputs(prev => ({ ...prev, [item.itemKey || item.displayKey]: 0 }));
  };

  const handleShortageEdit = async (item) => {
    const targetKey = (item.subItems && item.subItems.length > 0) ? item.subItems[0].itemKey : item.itemKey;
    const rec = purchaseRecords[targetKey] || {};
    const current = rec.shortage || 0;
    const newVal = prompt('부족수량 수정 (현재: ' + current + ')', String(current));
    if (newVal === null) return;
    const num = parseInt(newVal);
    if (isNaN(num) || num < 0) return;
    await savePurchaseRecord(targetKey, { shortage: num, updatedAt: new Date().toISOString() });
  };

  const isItemOrdered = (item) => {
    const currentStatus = selectedStatus;
    // SKU 그룹이면 subItems 전체의 구매량 합산
    let totalPurchased = 0;
    (item.subItems || [item]).forEach(sub => {
      const rec = purchaseRecords[sub.itemKey] || {};
      if (currentStatus === 'READY_TO_SHIP') totalPurchased += (rec.rtsQty || 0);
      else if (currentStatus === 'PROCESSED') totalPurchased += (rec.procQty || 0);
    });
    return totalPurchased >= item.totalQuantity;
  };

  const handleStatusClick = async (statusKey) => {
    setItemAggregation([]);
    setItemFilter('all');
    setInputQuantities({});
    if (viewMode === 'shops' && selectedStatus === statusKey) {
      setViewMode(null); setSelectedStatus(null); setShopCounts([]); setExpandedShop(null); setShopOrders([]);
      setExpandedOrder(null); setOrderDetail(null);
      return;
    }
    setViewMode('shops');
    setSelectedStatus(statusKey);
    setExpandedShop(null);
    setShopOrders([]);
    setExpandedOrder(null);
    setOrderDetail(null);
    setShopCountsLoading(true);
    try {
      const { getFirestore, collection, getDocs } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      const firestore = getFirestore();
      const auth = getAuth();
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) { setShopCountsLoading(false); return; }
      const countsSnap = await getDocs(collection(firestore, 'users', currentUid, 'orderCounts'));

      const filteredShops = getFilteredShops();
      const targetShopIds = (shopGroupData.selectedGroupId && shopGroupData.selectedGroupId !== 'all')
        ? filteredShops.map(s => String(s.shop_id))
        : null;

      const shopCountsList = [];
      countsSnap.forEach(doc => {
        const data = doc.data();
        const shopId = String(doc.id);
        if (targetShopIds && !targetShopIds.includes(shopId)) return;
        let count = 0;
        if (statusKey === 'IN_CANCEL') {
          count = (data['IN_CANCEL'] || 0) + (data['CANCELLED'] || 0);
        } else {
          count = data[statusKey] || 0;
        }
        if (count > 0) {
          const shopInfo = shops.find(s => String(s.shop_id) === shopId);
          shopCountsList.push({
            shop_id: shopId,
            shop_name: shopInfo?.shop_name || shopId,
            region: shopInfo?.region || '',
            count
          });
        }
      });
      shopCountsList.sort((a, b) => b.count - a.count);
      setShopCounts(shopCountsList);

      if (countsSnap.size === 0) {
        const result = await shopeeApiProxy({
          action: 'getCountsByShop',
          params: {
            orderStatus: statusKey,
            ...(shopGroupData.selectedGroupId && shopGroupData.selectedGroupId !== 'all'
              ? { shopIds: filteredShops.map(s => Number(s.shop_id)) }
              : {})
          }
        });
        const shopData = result.data?.shopCounts || [];
        shopData.sort((a, b) => b.count - a.count);
        setShopCounts(shopData);
      }
    } catch (e) {
      console.error('샵별 카운트 실패:', e);
    } finally {
      setShopCountsLoading(false);
    }
  };

  const handleShopStatusClick = async (shopId, status, shopName, region) => {
    if (expandedShop === shopId) { setExpandedShop(null); setShopOrders([]); setExpandedOrder(null); setOrderDetail(null); return; }
    setExpandedShop(shopId);
    setExpandedOrder(null);
    setOrderDetail(null);
    setShopOrdersLoading(true);
    setShopOrders([]);
    try {
      const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      const firestore = getFirestore();
      const auth = getAuth();
      const currentUid = auth.currentUser?.uid;

      if (currentUid) {
        const ordersRef = collection(firestore, 'users', currentUid, 'orders');
        const statusToQuery = status === 'IN_CANCEL' ? ['IN_CANCEL', 'CANCELLED'] : (status === 'PENDING' ? ['PENDING'] : [status]);
        let allOrders = [];
        for (const st of statusToQuery) {
          const q = query(ordersRef, where('shop_id', '==', String(shopId)), where('order_status', '==', st));
          const snap = await getDocs(q);
          snap.forEach(doc => allOrders.push(doc.data()));
        }
        allOrders.sort((a, b) => (b.create_time || 0) - (a.create_time || 0));
        setShopOrders(allOrders);

        if (allOrders.length === 0) {
          const now = Math.floor(Date.now() / 1000);
          const result = await shopeeApiProxy({
            action: 'getOrdersByStatus',
            shopId,
            params: { timeFrom: now - 14 * 86400, timeTo: now, pageSize: 100, orderStatus: status }
          });
          setShopOrders(result.data?.orders || []);
        }
      } else {
        const now = Math.floor(Date.now() / 1000);
        const result = await shopeeApiProxy({
          action: 'getOrdersByStatus',
          shopId,
          params: { timeFrom: now - 14 * 86400, timeTo: now, pageSize: 100, orderStatus: status }
        });
        setShopOrders(result.data?.orders || []);
      }
    } catch (e) {
      console.error('Order load error:', e);
      const now = Math.floor(Date.now() / 1000);
      const result = await shopeeApiProxy({
        action: 'getOrdersByStatus',
        shopId,
        params: { timeFrom: now - 14 * 86400, timeTo: now, pageSize: 100, orderStatus: status }
      });
      setShopOrders(result.data?.orders || []);
    } finally {
      setShopOrdersLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setSelectedStatus(null);
    setShopCounts([]);
    try {
      setRefreshStatus('샵 목록 갱신중..');
      localStorage.removeItem('shopee_shops');
      const result = await getConnectedShops();
      const shopList = result.data?.shops || [];
      setShops(shopList);
      localStorage.setItem('shopee_shops', JSON.stringify(shopList));

      setRefreshStatus('주문 현황 로딩중..');
      const { getFirestore, collection, getDocs } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      const fdb = getFirestore();
      const cuid = getAuth().currentUser?.uid;
      if (cuid) {
        const cSnap = await getDocs(collection(fdb, 'users', cuid, 'orderCounts'));
        const targetShops2 = getFilteredShops();
        const targetIds = new Set(targetShops2.map(s => String(s.shop_id)));
        const fresh = { READY_TO_SHIP: 0, PROCESSED: 0, SHIPPED: 0, COMPLETED: 0, IN_CANCEL: 0, PENDING: 0 };
        cSnap.forEach(d => {
          const v = d.data();
          if (targetIds.has(String(v.shop_id || d.id))) {
            ['READY_TO_SHIP', 'PROCESSED', 'SHIPPED', 'COMPLETED', 'IN_CANCEL', 'PENDING'].forEach(k => { fresh[k] += (v[k] || 0); });
            fresh.IN_CANCEL += (v['CANCELLED'] || 0);
          }
        });
        setTotalCounts(fresh);
      }

      setRefreshStatus('완료!');
      playPowerUpSound();
      setTimeout(() => setRefreshStatus(''), 2000);
    } catch (e) {
      console.error('새로고침 실패:', e);
      setRefreshStatus('실패: ' + (e?.message || '알 수 없는 오류'));
      setTimeout(() => setRefreshStatus(''), 3000);
    } finally {
      setRefreshing(false);
    }
  };

  
  // Get filtered shops based on selected group
  const getFilteredShops = () => {
    const gid = shopGroupData.selectedGroupId;
    if (!gid || gid === 'all') return shops;
    const group = shopGroupData.groups.find(g => g.id === gid);
    if (!group) return shops;
    return shops.filter(s => group.shopIds.includes(String(s.shop_id)));
  };

  const filteredShops = getFilteredShops();
  const selectedGroup = shopGroupData.groups.find(g => g.id === shopGroupData.selectedGroupId);

  const handleSelectGroup = async (groupId) => {
    const newId = shopGroupData.selectedGroupId === groupId ? null : groupId;
    setShopGroupData(prev => ({ ...prev, selectedGroupId: newId }));
    setTotalCounts({});
    setSalesData(null);
    setAnimatedTotal(0);
    setSalesExpanded(false);
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
    setRefreshStatus('주문 현황 로딩중..');
    try {
      const targetShops = newId
        ? shops.filter(s => { const g = shopGroupData.groups.find(gg => gg.id === newId); return g ? g.shopIds.includes(String(s.shop_id)) : true; })
        : shops;
      const { getFirestore, collection, getDocs } = await import('firebase/firestore');
      const { getAuth } = await import('firebase/auth');
      const fdb2 = getFirestore();
      const cuid2 = getAuth().currentUser?.uid;
      if (cuid2) {
        const cSnap2 = await getDocs(collection(fdb2, 'users', cuid2, 'orderCounts'));
        const tIds = new Set(targetShops.map(s => String(s.shop_id)));
        const cnt = { READY_TO_SHIP: 0, PROCESSED: 0, SHIPPED: 0, COMPLETED: 0, IN_CANCEL: 0, PENDING: 0 };
        cSnap2.forEach(d => {
          const v = d.data();
          if (tIds.has(String(v.shop_id || d.id))) {
            ['READY_TO_SHIP', 'PROCESSED', 'SHIPPED', 'COMPLETED', 'IN_CANCEL', 'PENDING'].forEach(k => { cnt[k] += (v[k] || 0); });
            cnt.IN_CANCEL += (v['CANCELLED'] || 0);
          }
        });
        setTotalCounts(cnt);
      } else {
        setTotalCounts({});
      }
      setRefreshStatus('완료!');
      setTimeout(() => setRefreshStatus(''), 2000);
            // 매출도 갱신
      loadSalesData();
    } catch(e) {
      console.error('Counts load error:', e);
      setRefreshStatus('로드 실패');
      setTimeout(() => setRefreshStatus(''), 3000);
    } finally {
      setCountsLoading(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!newGroupName.trim() || newGroupShops.length === 0) {
      alert('그룹 이름과 샵을 선택해주세요.');
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
  };

  const handleDeleteGroup = async (idx) => {
    if (!confirm('이 그룹을 삭제하시겠습니까?')) return;
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

  const visibleStatuses = STATUS_CONFIG.filter(st => {
    if (st.key === 'COMPLETED' && !showCompleted) return false;
    if (st.key === 'IN_CANCEL' && !showCancelled) return false;
    return true;
  });

  const validTokens = shops.filter(s => s.token_valid).length;

  const getFlagEmoji = (region) => REGION_FLAGS[(region || '').toUpperCase()] || REGION_FLAGS[region] || '\uD83C\uDFF3';

  if (!user || loading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh'}}><div>로딩중..</div></div>;

  return (
    <div style={{paddingBottom:80,maxWidth:500,margin:'0 auto',fontFamily:'-apple-system,sans-serif'}}>
      {/* ===== ?대?吏 ?뺣? 紐⑤떖 ===== */}
      {imageModal && (
        <div
          onClick={() => setImageModal(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', cursor: 'pointer',
          }}
        >
          <img
            src={imageModal.url}
            alt={imageModal.name || ''}
            style={{
              maxWidth: '90vw', maxHeight: '75vh',
              borderRadius: 12, objectFit: 'contain',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          />
          <div style={{ color: '#fff', marginTop: 12, fontSize: 14, textAlign: 'center', padding: '0 20px', maxWidth: '90vw' }}>
            {imageModal.name}
          </div>
          <div style={{ color: '#aaa', marginTop: 8, fontSize: 12 }}>??븯???リ린</div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{background:'linear-gradient(135deg,#ee4d2d,#ff6633)',color:'white',padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h1 style={{margin:0,fontSize:18}}>\uD83C\uDFEA Shopee Manager</h1>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={handleRefresh} disabled={refreshing} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'white',padding:'6px 12px',borderRadius:6,fontSize:13,cursor:'pointer'}}>
            {refreshing ? '\u23F3' : '\uD83D\uDD04'} 새로고침
          </button>
          <button onClick={() => { import('../lib/firebase').then(m => m.logout()).then(() => router.push('/login')); }} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'white',padding:'6px 12px',borderRadius:6,fontSize:13,cursor:'pointer'}}>로그아웃</button>
        </div>
      </div>

      {refreshStatus && (
        <div style={{margin:'0 16px',padding:'8px 12px',background:refreshStatus.includes('?ㅽ뙣')?'#fff0f0':'#f0f8ff',borderRadius:8,fontSize:13,color:refreshStatus.includes('?ㅽ뙣')?'#c62828':'#1565c0',textAlign:'center'}}>
          {refreshing && '??'}{refreshStatus}
        </div>
      )}

      {/* 오늘 매출 카드 */}
      <div style={{
        background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius:16, padding:'16px 20px', margin:'12px 16px 8px',
        color:'#fff', cursor:'pointer'
      }} onClick={() => salesData && setSalesExpanded(!salesExpanded)}>

        {salesLoading ? (
        <div style={{textAlign:'center',padding:'10px 0',fontSize:14,opacity:0.9}}>매출 데이터 로딩중..</div>
        ) : salesData ? (
          <>
          {/* 상단: 좌우 분할 */}
            <div style={{display:'flex',gap:16}}>
          {/* 왼쪽: 오늘 매출 */}
              <div style={{flex:1}}>
                <div style={{fontSize:11,opacity:0.8}}>오늘 매출</div>
                <div style={{fontSize:26,fontWeight:800,letterSpacing:-1,marginTop:2}}>
                  {'\u20A9'}{animatedTotal.toLocaleString()}
                </div>
                {salesData.totals.yesterday > 0 && (() => {
                  const diff = salesData.totals.today - salesData.totals.yesterday;
                  const pct = ((diff / salesData.totals.yesterday) * 100).toFixed(1);
                  const isUp = diff >= 0;
                  return (
                    <div style={{fontSize:11,marginTop:4,opacity:0.9}}>
                      어제 대비{' '}
                      <span style={{
                        background: isUp ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)',
                        padding:'1px 6px',borderRadius:8,fontWeight:700,fontSize:11
                      }}>
                        {isUp ? '\u25B2' : '\u25BC'}{Math.abs(Number(pct))}%
                      </span>
                    </div>
                  );
                })()}
              </div>
          {/* 오른쪽: 7일 30일 */}
              <div style={{display:'flex',flexDirection:'column',gap:6,minWidth:130}}>
                <div style={{background:'rgba(255,255,255,0.12)',borderRadius:10,padding:'6px 10px'}}>
                  <div style={{fontSize:10,opacity:0.7}}>최근 7일</div>
                  <div style={{fontSize:14,fontWeight:700}}>{'\u20A9'}{(salesData.totals.recent7||0).toLocaleString()}</div>
                  {salesData.totals.prev7 > 0 && (() => {
                    const diff = salesData.totals.recent7 - salesData.totals.prev7;
                    const pct = ((diff / salesData.totals.prev7) * 100).toFixed(1);
                    const isUp = diff >= 0;
                    return <div style={{fontSize:10,opacity:0.85}}><span style={{fontWeight:700,color:isUp?'#a5d6a7':'#ef9a9a'}}>{isUp?'\u25B2':'\u25BC'}{Math.abs(Number(pct))}%</span></div>;
                  })()}
                </div>
                <div style={{background:'rgba(255,255,255,0.12)',borderRadius:10,padding:'6px 10px'}}>
                  <div style={{fontSize:10,opacity:0.7}}>최근 30일</div>
                  <div style={{fontSize:14,fontWeight:700}}>{'\u20A9'}{(salesData.totals.recent30||0).toLocaleString()}</div>
                  {salesData.totals.prev30 > 0 && (() => {
                    const diff = salesData.totals.recent30 - salesData.totals.prev30;
                    const pct = ((diff / salesData.totals.prev30) * 100).toFixed(1);
                    const isUp = diff >= 0;
                    return <div style={{fontSize:10,opacity:0.85}}><span style={{fontWeight:700,color:isUp?'#a5d6a7':'#ef9a9a'}}>{isUp?'\u25B2':'\u25BC'}{Math.abs(Number(pct))}%</span></div>;
                  })()}
                </div>
              </div>
            </div>
          {/* 접기 */}
            <div style={{textAlign:'center',marginTop:8,fontSize:11,opacity:0.6}}>
            {salesExpanded ? '접기' : '샵별 상세'}
            </div>
          {/* 샵별 상세 */}
            {salesExpanded && (
              <div style={{marginTop:8,borderTop:'1px solid rgba(255,255,255,0.2)',paddingTop:8}}>
                {(salesData.shops || [])
                  .filter(s => (s.today||0) > 0 || (s.recent7||0) > 0 || (s.recent30||0) > 0)
                  .sort((a, b) => (b.today||0) - (a.today||0))
                  .map(s => {
                    const yDiff = (s.yesterday||0) > 0 ? (((s.today - s.yesterday) / s.yesterday) * 100).toFixed(0) : null;
                    const wDiff = (s.prev7||0) > 0 ? (((s.recent7 - s.prev7) / s.prev7) * 100).toFixed(0) : null;
                    const mDiff = (s.prev30||0) > 0 ? (((s.recent30 - s.prev30) / s.prev30) * 100).toFixed(0) : null;
                    const flag = getFlagEmoji(s.region);
                    return (
                      <div key={s.shop_id} style={{padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div>
                            <span style={{fontSize:12,opacity:0.9}}>{flag} {s.shop_name}</span>
                            {s.memo && <div style={{fontSize:10,opacity:0.55,marginTop:1}}>{s.memo}</div>}
                          </div>
                          <span style={{fontSize:13,fontWeight:700}}>{'\u20A9'}{(s.today||0).toLocaleString()}</span>
                        </div>
                        <div style={{display:'flex',gap:8,marginTop:3,fontSize:10,opacity:0.8}}>
                          {yDiff !== null && (
                            <span>전일 <span style={{color:Number(yDiff)>=0?'#a5d6a7':'#ef9a9a',fontWeight:600}}>{Number(yDiff)>=0?'\u25B2':'\u25BC'}{Math.abs(Number(yDiff))}%</span></span>
                          )}
                          <span>7일 {'\u20A9'}{(s.recent7||0).toLocaleString()}
                            {wDiff !== null && <span style={{color:Number(wDiff)>=0?'#a5d6a7':'#ef9a9a',fontWeight:600}}> {Number(wDiff)>=0?'\u25B2':'\u25BC'}{Math.abs(Number(wDiff))}%</span>}
                          </span>
                          <span>30일 {'\u20A9'}{(s.recent30||0).toLocaleString()}
                            {mDiff !== null && <span style={{color:Number(mDiff)>=0?'#a5d6a7':'#ef9a9a',fontWeight:600}}> {Number(mDiff)>=0?'\u25B2':'\u25BC'}{Math.abs(Number(mDiff))}%</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                {(salesData.shops || []).filter(s => (s.today||0) > 0 || (s.recent7||0) > 0 || (s.recent30||0) > 0).length === 0 && (
          <div style={{textAlign:'center',padding:'10px 0',opacity:0.7,fontSize:12}}>매출 데이터가 없습니다</div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{textAlign:'center',padding:'10px 0',opacity:0.8,fontSize:13}}>매출 데이터를 불러오는 중입니다</div>
        )}
      </div>

      <div style={{margin:'0 16px 8px'}}>
        <button onClick={() => router.push('/scan')}
          style={{width:'100%',padding:'12px',background:'#ee4d2d',color:'white',border:'none',borderRadius:10,fontSize:15,fontWeight:'bold',cursor:'pointer',boxShadow:'0 2px 6px rgba(238,77,45,0.3)'}}>
          셀 바코드 스캔
        </button>
      </div>

      
          {/* 그룹 선택 UI */}
      {shopGroupData.groups.length > 0 && (
        <div style={{margin:'0 16px 8px',display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
          <div onClick={() => handleSelectGroup(null)}
            style={{padding:'6px 14px',borderRadius:20,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
              background:!shopGroupData.selectedGroupId?'#ee4d2d':'white',
              color:!shopGroupData.selectedGroupId?'white':'#333',
              border:!shopGroupData.selectedGroupId?'none':'1px solid #ddd'}}>
              전체 ({shops.length})
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
                <span onClick={() => openEditGroup(idx)} style={{fontSize:10,cursor:'pointer',color:'#999'}}>✏️</span>
            </div>
          ))}
          <div onClick={openNewGroup}
            style={{padding:'6px 14px',borderRadius:20,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
              background:'white',color:'#ee4d2d',border:'1px dashed #ee4d2d'}}>
              + 그룹추가
          </div>
        </div>
      )}

      {shopGroupData.groups.length === 0 && (
        <div style={{margin:'0 16px 8px'}}>
          <div onClick={openNewGroup}
            style={{padding:'8px',borderRadius:8,fontSize:13,cursor:'pointer',textAlign:'center',
              background:'white',color:'#ee4d2d',border:'1px dashed #ee4d2d'}}>
            + 새 그룹 만들기          </div>
        </div>
      )}

      {/* ===== 상태 카드 영역 ===== */}
      <div style={{ margin: '0 16px 16px' }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>주문 상태 대시보드</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { key: 'READY_TO_SHIP', label: '발송대기', icon: '\uD83D\uDCE6', color: '#1a73e8' },
            { key: 'PROCESSED', label: '처리중', icon: '\uD83D\uDE9A', color: '#e65100' },
            { key: 'PENDING', label: '대기중', icon: '\u23F3', color: '#9c27b0' },
            { key: 'SHIPPED', label: '배송중', icon: '\uD83D\uDE9A', color: '#2e7d32' },
            { key: 'COMPLETED', label: '완료', icon: '\u2705', color: '#00695c' },
            { key: 'IN_CANCEL', label: '취소', icon: '\u274C', color: '#c62828' },
          ].map(st => {
            const count = totalCounts[st.key] ?? 0;
            const isSelected = selectedStatus === st.key;
            return (
              <div key={st.key} style={{
                background: isSelected ? '#fff' : '#f8f9fa',
                borderRadius: 12,
                border: isSelected ? `2px solid ${st.color}` : '2px solid transparent',
                overflow: 'hidden',
                boxShadow: isSelected ? `0 2px 8px ${st.color}33` : '0 1px 3px rgba(0,0,0,0.08)',
              }}>
                <div
                  onClick={() => {
                    if (viewMode === 'items' && selectedStatus === st.key) {
                      setViewMode(null); setSelectedStatus(null); setItemAggregation([]); setItemFilter('all');
                    } else {
                      setViewMode('items'); setSelectedStatus(st.key); setShopCounts([]); setExpandedShop(null); setShopOrders([]);
                      setItemFilter('all'); setInputQuantities({});
                      loadItemAggregation(st.key);
                    }
                  }}
                  style={{
                    padding: '10px 8px 6px', textAlign: 'center', cursor: 'pointer',
                    borderBottom: '1px solid #eee',
                    background: (viewMode === 'items' && isSelected) ? `${st.color}11` : 'transparent',
                  }}
                >
                  <div style={{ fontSize: 20 }}>{st.icon}</div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{st.label}</div>
                </div>
                <div
                  onClick={() => {
                    if (viewMode === 'shops' && selectedStatus === st.key) {
                      setViewMode(null); setSelectedStatus(null); setShopCounts([]); setExpandedShop(null); setShopOrders([]);
                    } else {
                      setViewMode('shops'); setItemAggregation([]); setItemFilter('all');
                      handleStatusClick(st.key);
                    }
                  }}
                  style={{
                    padding: '8px 8px 10px', textAlign: 'center', cursor: 'pointer',
                    background: (viewMode === 'shops' && isSelected) ? `${st.color}11` : 'transparent',
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, color: st.color }}>
                    {countsLoading ? (
                      <div style={{ width: 40, height: 24, background: '#f0f0f0', borderRadius: 4, margin: '0 auto', animation: 'pulse 1.5s infinite' }} />
                    ) : count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== 품목별 현황 (viewMode === 'items') ===== */}
      {viewMode === 'items' && selectedStatus && (
        <div style={{ margin: '0 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {selectedStatus === 'READY_TO_SHIP' ? '\uD83D\uDCE6 발송대기' : selectedStatus === 'PROCESSED' ? '\uD83D\uDE9A 처리중' : selectedStatus === 'PENDING' ? '\u23F3 대기중' : selectedStatus === 'SHIPPED' ? '\uD83D\uDE9A 배송중' : selectedStatus === 'COMPLETED' ? '\u2705 완료' : '\u274C 취소'} 품목 집계
            </div>
            <select
              value={itemSortBy}
              onChange={e => setItemSortBy(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
            >
              <option value="quantity">수량순</option>
              <option value="name">이름순</option>
              <option value="amount">금액순</option>
            </select>
          </div>

          {(selectedStatus === 'READY_TO_SHIP' || selectedStatus === 'PROCESSED') && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[
                { key: 'all', label: '전체' },
                { key: 'notOrdered', label: '미주문' },
                { key: 'ordered', label: '주문완료' }
              ].map(f => {
                let cnt = 0;
                if (f.key === 'all') cnt = itemAggregation.length;
                else if (f.key === 'ordered') cnt = itemAggregation.filter(i => isItemOrdered(i)).length;
                else cnt = itemAggregation.filter(i => !isItemOrdered(i)).length;
                return (
                  <button key={f.key} onClick={() => setItemFilter(f.key)} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: itemFilter === f.key ? '#1a73e8' : '#f0f0f0',
                    color: itemFilter === f.key ? '#fff' : '#666',
                  }}>
                    {f.label} ({cnt})
                  </button>
                );
              })}
            </div>
          )}

          {!itemAggLoading && itemAggregation.length > 0 && (
            <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
              총 {getFilteredAndSortedItems().length}종 / {getFilteredAndSortedItems().reduce((s, i) => s + i.totalQuantity, 0)}개            </div>
          )}

                {itemAggLoading && <div style={{ textAlign: "center", padding: 40, color: "#888" }}>품목 집계 중..</div>}

          {!itemAggLoading && itemAggregation.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>해당 품목 없음</div>
          )}

          {!itemAggLoading && getFilteredAndSortedItems().map((item, idx) => {
            const targetKey = (item.subItems && item.subItems.length > 0) ? item.subItems[0].itemKey : item.itemKey;
            const rec = purchaseRecords[targetKey] || {};
            const rtsQty = rec.rtsQty || 0;
            const procQty = rec.procQty || 0;
            const shortage = rec.shortage || 0;
            const hasStock = rec.hasStock || false;
            const totalPurchased = rtsQty + procQty;
            const displayId = item.itemKey || item.displayKey;
            const inputQty = inputQuantities[displayId] || 0;
            const shortageInput = shortageInputs[displayId] || 0;
            const ordered = isItemOrdered(item);
            const showPurchaseUI = selectedStatus === 'READY_TO_SHIP' || selectedStatus === 'PROCESSED';
            const showShortageUI = selectedStatus === 'PROCESSED';

            return (
              <div key={item.displayKey || (item.itemKey + '_' + item.region)} style={{
                background: hasStock ? '#f0f4ff' : ordered ? '#f0fff0' : '#fff',
                borderRadius: 12, padding: 14, marginBottom: 8,
                border: hasStock ? '1px solid #90caf9' : ordered ? '1px solid #a5d6a7' : '1px solid #eee',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                {/* ?곹뭹 ?뺣낫 */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div onClick={() => item.image_url && setImageModal({ url: item.image_url, name: item.item_name })}
                    style={{ flexShrink: 0, cursor: item.image_url ? 'pointer' : 'default' }}>
                    {item.image_url ? (
                      <img src={item.image_url} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '1px solid #eee' }} />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: 10, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>?벀</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {item.item_name}
                    </div>
                {item.model_name && <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>옵션: {item.model_name}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 13, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: '#1a73e8', fontWeight: 700 }}>{item.totalQuantity}개</span>
                      {item.regions && item.regions.length > 1 && (
                        <span style={{ fontSize: 11, color: '#555', background: '#f0f0f0', borderRadius: 4, padding: '1px 5px' }}>
                          {item.regions.join(' · ')}
                        </span>
                      )}
                      {item.regions && item.regions.length <= 1 && (
                        <span style={{ fontSize: 11, color: '#888' }}>({item.currency?.code})</span>
                      )}
                      <span style={{ fontWeight: 700, color: '#1a73e8' }}>
                        {item.regions && item.regions.length > 1
                          ? '₩' + Math.round(item.totalAmountKRW || 0).toLocaleString()
                          : formatAmount(item.totalAmount, item.region)
                        }
                      </span>
                      <span style={{ fontSize: 11, color: '#888' }}>{item.orderCount}주문</span>
                    </div>
                  </div>
                </div>

                {/* 부족수량 (처리중에서만, 재고관련) */}
                {showShortageUI && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '8px 10px', background: '#fff5f5', borderRadius: 10, border: '1px solid #ffcdd2' }}>
                      <span style={{ fontSize: 12, color: '#c62828', fontWeight: 600 }}>📋 부족수량:</span>
                    {shortage > 0 && (
                      <span onClick={() => handleShortageEdit(item)} style={{ background: '#ffcdd2', color: '#b71c1c', padding: '2px 10px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        {shortage}개                      </span>
                    )}
                    <button onClick={() => handleShortageAdd(displayId)} style={{ width: 36, height: 32, borderRadius: 8, border: '1px solid #ef9a9a', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#c62828' }}>+1</button>
                    <div style={{ minWidth: 30, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: shortageInput > 0 ? '#ffcdd2' : '#f0f0f0', borderRadius: 8, fontSize: 14, fontWeight: 700, color: shortageInput > 0 ? '#b71c1c' : '#999' }}>
                      {shortageInput}
                    </div>
                    {shortageInput > 0 && (
                      <>
                        <button onClick={() => setShortageInputs(prev => ({ ...prev, [displayId]: 0 }))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #eee', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#999' }}>\u2715</button>
                        <button onClick={() => handleShortageConfirm(item)} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: 'none', background: '#c62828', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>확인</button>
                      </>
                    )}
                  </div>
                )}

                {/* 구매이력 + 재고보유 */}
                {showPurchaseUI && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {rtsQty > 0 && (
                      <div onClick={() => handleQtyEdit(item, 'rts')} style={{ background: '#e3f2fd', color: '#1565c0', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        발송대기 {rtsQty}개 ✎                      </div>
                    )}
                    {procQty > 0 && (
                      <div onClick={() => handleQtyEdit(item, 'proc')} style={{ background: '#fff3e0', color: '#e65100', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        처리중 {procQty}개 ✎                      </div>
                    )}
                    {shortage > 0 && (
                      <div style={{ background: '#ffebee', color: '#c62828', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                        부족 {shortage}개                      </div>
                    )}
                    {(rtsQty > 0 || procQty > 0) && (
                      <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                        총 구매 {totalPurchased}개                      </div>
                    )}
                    <button onClick={() => handleStockToggle(item)} style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', marginLeft: 'auto',
                      background: hasStock ? '#1565c0' : '#f0f0f0', color: hasStock ? '#fff' : '#888'
                    }}>
                      {hasStock ? '\uD83D\uDCE6 \uC7A5\uAD34\uBCF4\uC720 \u2713' : '\uD83D\uDCE6 \uC7A5\uAD34\uBCF4\uC720'}
                    </button>
                  </div>
                )}

                {/* 구매수량 입력 (발송대기 처리중에서만) */}
                {showPurchaseUI && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '8px 10px', background: '#fafafa', borderRadius: 10 }}>
                      <span style={{ fontSize: 12, color: '#888', marginRight: 4 }}>🛒 구매:</span>
                    <button onClick={() => handleQtyAdd(displayId, 10)} style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid #ccc', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#1a73e8' }}>+10</button>
                    <button onClick={() => handleQtyAdd(displayId, 1)} style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid #ccc', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#1a73e8' }}>+1</button>
                    <div style={{ minWidth: 40, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: inputQty > 0 ? '#e3f2fd' : '#f0f0f0', borderRadius: 8, fontSize: 16, fontWeight: 700, color: inputQty > 0 ? '#1565c0' : '#999', padding: '0 8px' }}>
                      {inputQty}
                    </div>
                    {inputQty > 0 && (
                      <button onClick={() => handleQtyReset(displayId)} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #eee', background: '#fff', fontSize: 16, cursor: 'pointer', color: '#999', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>\u2715</button>
                    )}
                    <button onClick={() => handleQtyConfirm(item)} disabled={inputQty <= 0} style={{
                      height: 36, padding: '0 14px', borderRadius: 8, border: 'none',
                      background: inputQty > 0 ? (selectedStatus === 'READY_TO_SHIP' ? '#1565c0' : '#e65100') : '#e0e0e0',
                      color: inputQty > 0 ? '#fff' : '#999', fontSize: 13, fontWeight: 700,
                      cursor: inputQty > 0 ? 'pointer' : 'default', marginLeft: 'auto'
                        }}>완료</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 상태 클릭 시 샵별 서브패널 */}
      {viewMode === 'shops' && selectedStatus && (
        <div style={{margin:'16px'}}>
          <h4 style={{fontSize:14,color:'#666'}}>
                {visibleStatuses.find(s=>s.key===selectedStatus)?.icon} {visibleStatuses.find(s=>s.key===selectedStatus)?.label}
          </h4>
          {shopCountsLoading ? (
            <div style={{textAlign:'center',padding:20,color:'#999'}}>로딩중..</div>
          ) : shopCounts.length === 0 ? (
            <div style={{textAlign:'center',padding:20,color:'#999'}}>?대떦 주문 ?놁쓬</div>
          ) : (
            shopCounts.map(sc => (
              <div key={sc.shop_id}>
                <div
                  onClick={() => handleShopStatusClick(sc.shop_id, selectedStatus, sc.shop_name, sc.region)}
                  style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',borderBottom:'1px solid #f0f0f0',cursor:'pointer',background:expandedShop===sc.shop_id?'#fff8f0':'white',borderRadius:8,marginBottom:expandedShop===sc.shop_id?0:8,boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}
                >
                  <span style={{fontSize:14}}>{REGION_FLAGS[sc.region]||'?뙋'} {sc.shop_name || sc.shop_id}</span>
                                                  {sc.memo && <span style={{fontSize:11,color:'#999',marginLeft:6}}>({sc.memo})</span>}
                  <span style={{fontSize:16,fontWeight:'bold',color:'#ee4d2d'}}>{sc.count}</span>
                </div>

                {expandedShop === sc.shop_id && (
                  <div style={{background:'#fafafa',borderBottom:'1px solid #eee'}}>
                    {shopOrdersLoading ? (
                      <div style={{textAlign:'center',padding:16,color:'#999',fontSize:13}}>주문 로딩중..</div>
                    ) : shopOrders.length === 0 ? (
                    <div style={{textAlign:'center',padding:16,color:'#999',fontSize:13}}>주문이 없습니다</div>
                    ) : (
                      shopOrders.map(order => {
                        const items = order.item_list || [];
                        const firstItem = items[0] || {};
                        const totalQty = items.reduce((sum, it) => sum + (it.model_quantity_purchased || it.quantity || 1), 0);
                        const currency = getCurrency(sc.region);
                        const isExpanded = expandedOrder === order.order_sn;

                        return (
                          <div key={order.order_sn}>
                            <div
                              onClick={() => handleOrderClick(order, sc.shop_id)}
                              style={{display:'flex',gap:10,padding:'10px 16px',borderBottom:'1px solid #f0f0f0',cursor:'pointer',alignItems:'center',background:isExpanded?'#fff8f0':'white'}}
                            >
                              <div style={{position:'relative',width:50,height:50,flexShrink:0}}
                                onClick={(e) => { e.stopPropagation(); openImagePreview(items, 0); }}>
                                {firstItem.image_info?.image_url ? (
                                  <img src={firstItem.image_info.image_url} alt="" style={{width:50,height:50,borderRadius:6,objectFit:'cover',cursor:'zoom-in'}} onError={e=>e.target.style.display='none'} />
                                ) : (
                                  <div style={{width:50,height:50,borderRadius:6,background:'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>?벀</div>
                                )}
                                {items.length > 1 && (
                                  <div style={{position:'absolute',top:-4,right:-4,background:'#ee4d2d',color:'white',borderRadius:'50%',width:18,height:18,fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'bold'}}>{items.length}</div>
                                )}
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:'bold',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{firstItem.item_name || order.order_sn}</div>
                    <div style={{fontSize:11,color:'#888',marginTop:2}}>{order.order_sn} · 수량 {totalQty}</div>
                              </div>
                              <div style={{textAlign:'right',flexShrink:0}}>
                                <div style={{fontSize:13,fontWeight:'bold',color:'#ee4d2d'}}>{currency}{order.total_amount || '-'}</div>
                                <div style={{fontSize:10,color:'#999'}}>{isExpanded ? '\u25B2' : '\u25BC'}</div>
                              </div>
                            </div>

                            {isExpanded && (
                              <div style={{background:'#fefefe',padding:'12px 16px',borderBottom:'2px solid #eee'}}>
                                {orderDetailLoading ? (
                    <div style={{textAlign:'center',padding:16,color:'#999',fontSize:13}}>상세 로딩중..</div>
                                ) : orderDetail ? (
                                  <div>
                                    <div style={{fontSize:12,color:'#666',lineHeight:1.8,marginBottom:12,padding:'8px 12px',background:'#f9f9f9',borderRadius:8}}>
                                      <div>?뫀 {orderDetail.buyer_username || '-'}</div>
                                      {orderDetail.tracking_number && <div>?슊 {orderDetail.tracking_number}</div>}
                                      {orderDetail.shipping_carrier && <div>?벍 {orderDetail.shipping_carrier}</div>}
                                      <div>?뮥 珥앹븸: <strong>{currency}{orderDetail.total_amount || '-'}</strong></div>
                                      {orderDetail.pay_time && <div>결제: {new Date(orderDetail.pay_time * 1000).toLocaleDateString('ko-KR')} {new Date(orderDetail.pay_time * 1000).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</div>}
                                    </div>

                                    <div style={{marginBottom:12}}>
                                      <div style={{fontWeight:'bold',fontSize:13,marginBottom:8}}>주문상품 상세</div>
                                      {(orderDetail.item_list || []).map((item, i) => {
                                        const stockKey = item.model_id ? `${item.item_id}_${item.model_id}` : item.item_id;
                                        const currentStock = orderItemStocks[stockKey]?.stock ?? orderItemStocks[item.item_id]?.total ?? '-';
                                        return (
                                          <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:i<(orderDetail.item_list?.length||1)-1?'1px solid #f0f0f0':'none'}}>
                                            <div style={{width:60,height:60,borderRadius:6,overflow:'hidden',flexShrink:0,background:'#f0f0f0',cursor:'zoom-in'}}
                                              onClick={(e) => { e.stopPropagation(); openImagePreview(orderDetail.item_list || [], i); }}>
                                              {item.image_info?.image_url ? (
                                                <img src={item.image_info.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                                              ) : (
                                                <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>?벀</div>
                                              )}
                                            </div>
                                            <div style={{flex:1,fontSize:12}}>
                                              <div style={{fontWeight:'bold',marginBottom:2}}>{item.item_name}</div>
                              {item.model_name && <div style={{color:'#999',marginBottom:2}}>옵션: {item.model_name}</div>}
                                              <div style={{display:'flex',justifyContent:'space-between'}}>
                              <span>수량: {item.model_quantity_purchased || 1}</span>
                                                <span style={{color:'#ee4d2d',fontWeight:'bold'}}>{currency}{item.model_discounted_price || item.model_original_price || '-'}</span>
                                              </div>
                                              <div style={{marginTop:4,color:'#888'}}>
                                                현재고: <strong style={{color:typeof currentStock==='number'&&currentStock<=0?'#c62828':typeof currentStock==='number'&&currentStock<=5?'#e65100':'#2e7d32'}}>{currentStock}</strong>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div style={{display:'flex',gap:8}}>
                                      <button onClick={() => {
                                        const o = orderDetail;
                                        router.push(`/chat?shopId=${sc.shop_id}&buyerId=${o.buyer_user_id||''}&orderSn=${encodeURIComponent(o.order_sn)}&buyerName=${encodeURIComponent(o.buyer_username||'')}`);
                                      }} style={{flex:1,padding:'8px',background:'#ee4d2d',color:'white',border:'none',borderRadius:6,fontSize:12,cursor:'pointer'}}>?뮠 梨꾪똿</button>
                                      <button onClick={() => router.push(`/order/${orderDetail.order_sn}?shopId=${sc.shop_id}&shopName=${encodeURIComponent(sc.shop_name||'')}&region=${sc.region}`)}
                                        style={{flex:1,padding:'8px',background:'white',color:'#ee4d2d',border:'1px solid #ee4d2d',borderRadius:6,fontSize:12,cursor:'pointer'}}>📋 전체보기</button>
                                    </div>
                                  </div>
                                ) : (
                    <div style={{textAlign:'center',padding:16,color:'#999',fontSize:13}}>상세 정보를 불러오는 중입니다</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {previewImages && (
        <div onClick={() => setPreviewImages(null)}
          style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.92)',zIndex:9999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',touchAction:'none'}}>

          <div style={{color:'white',fontSize:13,marginBottom:8,flexShrink:0}}>
            {previewImages.currentIndex + 1} / {previewImages.images.length}
          </div>

          <div style={{position:'relative',width:'100vw',flex:'0 0 auto',display:'flex',alignItems:'center',justifyContent:'center',maxHeight:'55vh'}}
            onTouchStart={(e) => { e.currentTarget._touchX = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              const diff = e.changedTouches[0].clientX - (e.currentTarget._touchX || 0);
              if (Math.abs(diff) > 50) {
                e.stopPropagation();
                setPreviewImages(prev => {
                  if (!prev) return null;
                  const len = prev.images.length;
                  const next = diff < 0
                    ? (prev.currentIndex + 1) % len
                    : (prev.currentIndex - 1 + len) % len;
                  return { ...prev, currentIndex: next };
                });
              }
            }}
            onClick={(e) => e.stopPropagation()}>

            {previewImages.images.length > 1 && (
              <button onClick={(e) => {
                e.stopPropagation();
                setPreviewImages(prev => prev && ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length }));
              }} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',background:'rgba(255,255,255,0.2)',border:'none',color:'white',fontSize:28,borderRadius:'50%',width:40,height:40,cursor:'pointer',zIndex:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                ??              </button>
            )}

            <img src={previewImages.images[previewImages.currentIndex].url} alt=""
              style={{maxWidth:'80vw',maxHeight:'55vh',objectFit:'contain',borderRadius:8}} />

            <div style={{position:'absolute',bottom:12,right:'12%',background:'rgba(238,77,45,0.9)',color:'white',borderRadius:14,padding:'3px 12px',fontSize:14,fontWeight:'bold'}}>
              x{previewImages.images[previewImages.currentIndex].qty}
            </div>

            {previewImages.images.length > 1 && (
              <button onClick={(e) => {
                e.stopPropagation();
                setPreviewImages(prev => prev && ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length }));
              }} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'rgba(255,255,255,0.2)',border:'none',color:'white',fontSize:28,borderRadius:'50%',width:40,height:40,cursor:'pointer',zIndex:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                ??              </button>
            )}
          </div>

          <div style={{color:'white',fontSize:12,marginTop:8,textAlign:'center',padding:'0 20px',maxWidth:'90vw',flexShrink:0}}>
            <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {previewImages.images[previewImages.currentIndex].name}
            </div>
            {previewImages.images[previewImages.currentIndex].option && (
            <div style={{color:'#ccc',fontSize:11,marginTop:2}}>옵션: {previewImages.images[previewImages.currentIndex].option}</div>
            )}
          </div>

          {previewImages.images.length > 1 && (
            <div onClick={(e) => e.stopPropagation()}
              style={{marginTop:12,width:'100%',maxWidth:'90vw',overflowX:'auto',overflowY:'hidden',flexShrink:0,WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}>
              <div style={{display:'inline-flex',gap:6,padding:'4px 8px',minWidth:'100%',justifyContent:previewImages.images.length<=5?'center':'flex-start'}}>
                {previewImages.images.map((img, idx) => (
                  <div key={idx}
                    onClick={(e) => { e.stopPropagation(); setPreviewImages(prev => ({...prev, currentIndex: idx})); }}
                    style={{position:'relative',width:48,height:48,borderRadius:6,overflow:'hidden',flexShrink:0,
                      border:idx===previewImages.currentIndex?'2px solid #ee4d2d':'2px solid rgba(255,255,255,0.3)',
                      cursor:'pointer',opacity:idx===previewImages.currentIndex?1:0.6,transition:'all 0.2s'}}>
                    <img src={img.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    <div style={{position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,0.65)',color:'white',fontSize:9,textAlign:'center',padding:'1px 0'}}>
                      x{img.qty}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        <div style={{color:'#666',fontSize:11,marginTop:12,flexShrink:0}}>바닥 영역에 도달하면 멈춥니다</div>
        </div>
      )}

      
      {/* 그룹 ?앹꽦/?섏젙 紐⑤떖 */}
      {showGroupModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={() => setShowGroupModal(false)}>
          <div style={{background:'white',borderRadius:16,padding:20,width:'90%',maxWidth:400,maxHeight:'80vh',overflowY:'auto'}}
            onClick={e => e.stopPropagation()}>
            <h3 style={{margin:'0 0 16px',fontSize:16}}>{editingGroup !== null ? '그룹 수정' : '새 그룹 만들기'}</h3>
            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              placeholder="그룹 이름"
              style={{width:'100%',padding:12,border:'1px solid #ddd',borderRadius:8,fontSize:14,marginBottom:16,boxSizing:'border-box'}} />
            <div style={{fontSize:13,color:'#666',marginBottom:8}}>샵 선택 ({newGroupShops.length}개)</div>
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
                  ??젣
                </button>
              )}
              <button onClick={() => setShowGroupModal(false)}
                style={{flex:1,padding:'10px',background:'#f0f0f0',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>
                취소
              </button>
              <button onClick={handleSaveGroup}
                style={{flex:1,padding:'10px',background:'#ee4d2d',color:'white',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontWeight:'bold'}}>
                ???              </button>
            </div>
          </div>
        </div>
      )}


      <BottomNav active="home" />
    </div>
  );
}


