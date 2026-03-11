'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthChange, getConnectedShops, shopeeApiProxy } from '../../lib/firebase';
import BottomNav from '../../components/BottomNav';

const REGION_FLAGS = {
  SG: '🇸🇬', MY: '🇲🇾', PH: '🇵🇭', TH: '🇹🇭', TW: '🇹🇼',
  VN: '🇻🇳', BR: '🇧🇷', MX: '🇲🇽', ID: '🇮🇩',
  sg: '🇸🇬', my: '🇲🇾', ph: '🇵🇭', th: '🇹🇭', tw: '🇹🇼',
  vn: '🇻🇳', br: '🇧🇷', mx: '🇲🇽', id: '🇮🇩',
};

const TABS = [
  { key: 'READY_TO_SHIP', label: '발송대기', icon: '📋', color: '#e65100' },
  { key: 'PROCESSED', label: '처리중', icon: '⚙️', color: '#f57c00' },
  { key: 'SHIPPED', label: '배송중', icon: '🚚', color: '#1565c0' },
  { key: 'COMPLETED', label: '완료', icon: '✅', color: '#2e7d32' },
  { key: 'IN_CANCEL', label: '취소/반품', icon: '↩️', color: '#c62828' },
];

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopIdParam = searchParams.get('shopId');
  const statusParam = searchParams.get('status');

  const [user, setUser] = useState(null);
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(shopIdParam || '');
  const [allOrders, setAllOrders] = useState([]);
  const [activeTab, setActiveTab] = useState(statusParam || 'READY_TO_SHIP');
  const [loading, setLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [counts, setCounts] = useState({});
  const [orderListLoadedOnce, setOrderListLoadedOnce] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  useEffect(() => {
    setShowCompleted(localStorage.getItem('shopee_show_completed') === 'true');
    setShowCancelled(localStorage.getItem('shopee_show_cancelled') === 'true');
  }, []);

  const visibleTabs = TABS.filter(t => {
    if (t.key === 'COMPLETED' && !showCompleted) return false;
    if (t.key === 'IN_CANCEL' && !showCancelled) return false;
    return true;
  });

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      if (!u) router.push('/login');
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (user) loadShops();
  }, [user]);

  useEffect(() => {
    if (selectedShop) loadCounts(selectedShop);
  }, [selectedShop]);

  useEffect(() => {
    if (selectedShop && statusParam && visibleTabs.some(t => t.key === statusParam)) {
      setActiveTab(statusParam);
      loadOrdersByStatus(statusParam);
    }
  }, [selectedShop, statusParam]);

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some(t => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [showCompleted, showCancelled]);

  const loadShops = async () => {
    const cached = localStorage.getItem('shopee_shops');
    if (cached) {
      try {
        const shopList = JSON.parse(cached);
        setShops(shopList);
        if (!selectedShop && shopList.length > 0) {
          setSelectedShop(shopList[0].shop_id);
        }
      } catch (e) {}
    }
    try {
      const result = await getConnectedShops();
      const shopList = result.data?.shops || [];
      setShops(shopList);
      localStorage.setItem('shopee_shops', JSON.stringify(shopList));
      if (!selectedShop && shopList.length > 0) {
        setSelectedShop(shopList[0].shop_id);
      }
    } catch (e) {
      console.error('샵 로드 실패:', e);
    }
  };

  const loadCounts = async (shopId) => {
    try {
      setLoading(true);
      setCounts({});
      setAllOrders([]);
      setOrderListLoadedOnce(false);
      const now = Math.floor(Date.now() / 1000);
      const timeFrom = now - 14 * 86400;
      const result = await shopeeApiProxy({
        action: 'getOrderCounts',
        shopId: shopId,
        params: { timeFrom, timeTo: now }
      });
      const countsData = result.data?.counts || {};
      setCounts(countsData);
    } catch (e) {
      console.error('카운트 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadOrdersByStatus = async (status) => {
    try {
      setOrderLoading(true);
      setAllOrders([]);
      const now = Math.floor(Date.now() / 1000);
      const timeFrom = now - 14 * 86400;
      const result = await shopeeApiProxy({
        action: 'getOrdersByStatus',
        shopId: selectedShop,
        params: { timeFrom, timeTo: now, pageSize: 50, orderStatus: status }
      });
      const orders = result.data?.orders || [];
      setAllOrders(orders.map(o => ({ ...o, _status_group: o.order_status === 'CANCELLED' ? 'IN_CANCEL' : o.order_status })));
      setOrderListLoadedOnce(true);
    } catch (e) {
      console.error('주문 로드 실패:', e);
    } finally {
      setOrderLoading(false);
    }
  };

  const getFilteredOrders = () => {
    if (activeTab === 'IN_CANCEL') {
      return allOrders.filter(o =>
        o._status_group === 'IN_CANCEL' || o._status_group === 'CANCELLED' ||
        o.order_status === 'IN_CANCEL' || o.order_status === 'CANCELLED'
      );
    }
    return allOrders.filter(o => o._status_group === activeTab || o.order_status === activeTab);
  };

  const getStatusBadge = (status) => {
    const map = {
      UNPAID: { label: '미결제', bg: '#fff3e0', color: '#e65100' },
      READY_TO_SHIP: { label: '발송대기', bg: '#fff3e0', color: '#e65100' },
      PROCESSED: { label: '처리중', bg: '#fff8e1', color: '#f57c00' },
      SHIPPED: { label: '배송중', bg: '#e3f2fd', color: '#1565c0' },
      COMPLETED: { label: '완료', bg: '#e8f5e9', color: '#2e7d32' },
      IN_CANCEL: { label: '취소중', bg: '#ffebee', color: '#c62828' },
      CANCELLED: { label: '취소됨', bg: '#ffebee', color: '#c62828' },
      INVOICE_PENDING: { label: '인보이스대기', bg: '#f3e5f5', color: '#7b1fa2' },
    };
    return map[status] || { label: status, bg: '#f5f5f5', color: '#666' };
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const currentShop = shops.find(s => String(s.shop_id) === String(selectedShop));
  const filteredOrders = getFilteredOrders();

  if (!user) return null;

  return (
    <div>
      <div className="header">
        <span>📦 주문 관리</span>
        <button
          onClick={() => selectedShop && loadCounts(selectedShop)}
          style={{background:'none',border:'none',color:'white',fontSize:'14px',cursor:'pointer'}}
        >
          🔄 새로고침
        </button>
      </div>

      {/* 샵 선택 */}
      <div style={{padding:'12px 12px 0'}}>
        <select
          className="select"
          value={selectedShop}
          onChange={(e) => setSelectedShop(e.target.value)}
        >
          {shops.map((s, i) => (
            <option key={i} value={s.shop_id}>
              {REGION_FLAGS[s.region] || '🏪'} {s.shop_name || s.memo || s.shop_id} ({(s.region || '').toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {/* 상태 탭 */}
      <div style={{
        display:'flex', overflowX:'auto', gap:'4px',
        padding:'12px', WebkitOverflowScrolling:'touch',
      }}>
        {visibleTabs.map((tab) => {
          const count = counts[tab.key] || 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); loadOrdersByStatus(tab.key); }}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center',
                padding:'8px 12px', borderRadius:'8px', border:'none',
                background: isActive ? tab.color : '#f5f5f5',
                color: isActive ? 'white' : '#666',
                fontSize:'12px', cursor:'pointer', minWidth:'70px',
                flexShrink:0, transition:'all 0.2s',
              }}
            >
              <span style={{fontSize:'18px'}}>{tab.icon}</span>
              <span style={{fontWeight:'bold',marginTop:'2px'}}>{tab.label}</span>
              <span style={{
                fontSize:'11px', marginTop:'2px',
                background: isActive ? 'rgba(255,255,255,0.3)' : '#e0e0e0',
                borderRadius:'10px', padding:'0 6px',
              }}>
                {loading ? '-' : count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 주문 목록 */}
      {loading ? (
        <div style={{textAlign:'center',padding:'40px'}}>
          <div className="spinner" style={{margin:'0 auto 12px'}}></div>
          <div style={{color:'#666',fontSize:'13px'}}>카운트 조회 중...</div>
        </div>
      ) : !orderListLoadedOnce ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>상태를 선택하세요</p>
        </div>
      ) : orderLoading ? (
        <div style={{textAlign:'center',padding:'40px'}}>
          <div className="spinner" style={{margin:'0 auto 12px'}}></div>
          <div style={{color:'#666',fontSize:'13px'}}>주문 조회 중...</div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📭</div>
          <p>{visibleTabs.find(t => t.key === activeTab)?.label || ''} 주문이 없습니다</p>
        </div>
      ) : (
        <div style={{padding:'0 12px'}}>
          <div style={{fontSize:'12px',color:'#999',marginBottom:'8px'}}>
            {filteredOrders.length}건
          </div>
          {filteredOrders.map((order, i) => {
            const badge = getStatusBadge(order.order_status);
            return (
              <div
                key={i}
                className="order-card"
                onClick={() => router.push(`/order/${order.order_sn}?shopId=${selectedShop}&shopName=${encodeURIComponent(currentShop?.shop_name || '')}&region=${currentShop?.region || ''}`)}
                style={{cursor:'pointer',margin:'6px 0',border:'1px solid #f0f0f0'}}
              >
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span className="order-sn">{order.order_sn}</span>
                  <span style={{
                    fontSize:'11px', padding:'2px 8px', borderRadius:'10px',
                    background: badge.bg, color: badge.color,
                  }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{fontSize:'11px',color:'#999',marginTop:'4px'}}>클릭 시 상세 보기</div>
              </div>
            );
          })}
        </div>
      )}

      <BottomNav active="orders" />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner"></div></div>}>
      <OrdersContent />
    </Suspense>
  );
}
