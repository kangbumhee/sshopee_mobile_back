'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthChange, shopeeApiProxy } from '../../../lib/firebase';
import BottomNav from '../../../components/BottomNav';

const STATUS_LABELS = {
  UNPAID:'미결제', READY_TO_SHIP:'발송대기', PROCESSED:'처리중',
  SHIPPED:'배송중', COMPLETED:'완료', IN_CANCEL:'취소중', CANCELLED:'취소됨',
};

const getCurrency = (region) => {
  const map = { SG:'S$', MY:'RM', PH:'₱', TH:'฿', TW:'NT$', VN:'₫', BR:'R$', MX:'MX$', ID:'Rp' };
  return map[region] || '$';
};

function OrderDetail({ orderSn: propOrderSn }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopId = searchParams.get('shopId');
  const shopName = searchParams.get('shopName') || '';
  const region = searchParams.get('region') || '';
  const currency = getCurrency(region);

  const [actualOrderSn, setActualOrderSn] = useState(propOrderSn);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const sn = path.split('/order/')[1]?.split('?')[0];
      if (sn && sn !== '0') setActualOrderSn(sn);
    }
  }, []);

  const [user, setUser] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockModal, setStockModal] = useState(null);
  const [newStock, setNewStock] = useState('');
  const [stockLoading, setStockLoading] = useState(false);
  const [stockResult, setStockResult] = useState(null);
  const [itemStocks, setItemStocks] = useState({});
  const [cancelLoading, setCancelLoading] = useState(false);
  const [globalStockLoading, setGlobalStockLoading] = useState(false);
  const [globalStockResult, setGlobalStockResult] = useState(null);

  useEffect(() => {
    const unsub = onAuthChange(u => { setUser(u); if (!u) router.push('/login'); });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (user && actualOrderSn && actualOrderSn !== '0' && shopId) {
      loadOrderDetail();
    }
  }, [user, actualOrderSn, shopId]);

  const loadOrderDetail = async () => {
    try {
      setLoading(true);
      const result = await shopeeApiProxy({ action: 'getOrderDetail', shopId, params: { orderSnList: [actualOrderSn] } });
      const orderList = result.data?.response?.order_list || [];
      if (orderList.length > 0) {
        setOrder(orderList[0]);
        loadItemStocks(orderList[0].item_list || []);
      } else {
        setError('주문을 찾을 수 없습니다');
      }
    } catch (e) { setError('로드 실패: ' + e.message); }
    finally { setLoading(false); }
  };

  const loadItemStocks = async (items) => {
    if (!items.length) return;
    try {
      const itemIds = [...new Set(items.map(i => i.item_id))];
      const result = await shopeeApiProxy({ action: 'getItemBaseInfo', shopId, params: { itemIds } });
      const itemList = result.data?.items || result.data?.response?.item_list || [];
      const stocks = {};
      itemList.forEach(item => {
        if (item.stock_info_v2?.summary_info) {
          stocks[item.item_id] = { total: item.stock_info_v2.summary_info.total_available_stock || 0 };
        }
        if (item.model_list) {
          item.model_list.forEach(m => {
            const key = `${item.item_id}_${m.model_id}`;
            stocks[key] = { stock: m.stock_info_v2?.summary_info?.total_available_stock ?? m.normal_stock ?? 0 };
          });
        }
      });
      setItemStocks(stocks);
    } catch (e) { console.error('재고 조회 실패:', e); }
  };

  const handleUpdateStock = async (globalUpdate = false) => {
    if (!stockModal || !newStock) return;
    if (globalUpdate) {
      setGlobalStockLoading(true);
      setGlobalStockResult(null);
      try {
        const result = await shopeeApiProxy({
          action: 'updateGlobalStock',
          shopId,
          params: { itemId: stockModal.item_id, modelId: stockModal.model_id || 0, newStock: parseInt(newStock, 10) }
        });
        const res = result.data?.result || result.data || {};
        if (res.error) {
          setGlobalStockResult({ success: false, message: res.message || '글로벌 업데이트 실패' });
        } else {
          setGlobalStockResult({ success: true, message: `글로벌 재고 ${newStock}개로 수정 완료` });
          setTimeout(() => { setStockModal(null); setGlobalStockResult(null); setNewStock(''); loadOrderDetail(); }, 1500);
        }
      } catch (e) { setGlobalStockResult({ success: false, message: e.message }); }
      finally { setGlobalStockLoading(false); }
    } else {
      setStockLoading(true);
      setStockResult(null);
      try {
        const stockData = { item_id: stockModal.item_id, stock_list: [{ model_id: stockModal.model_id || 0, normal_stock: parseInt(newStock, 10) }] };
        const res = await shopeeApiProxy({ action: 'updateStock', shopId, params: { stockData } });
        if (res.data?.error) { setStockResult({ success: false, message: res.data.message || '실패' }); }
        else { setStockResult({ success: true, message: '재고 수정 완료' }); setTimeout(() => { setStockModal(null); setStockResult(null); setNewStock(''); loadOrderDetail(); }, 1500); }
      } catch (e) { setStockResult({ success: false, message: e.message }); }
      finally { setStockLoading(false); }
    }
  };

  const handleCancelOrder = async () => {
    if (!confirm(`주문 ${actualOrderSn}을 취소하시겠습니까?`)) return;
    const reason = prompt('취소 사유를 선택해주세요:\n1. 재고 부족\n2. 고객 요청\n3. 기타', '1');
    const reasonMap = { '1': 'OUT_OF_STOCK', '2': 'CUSTOMER_REQUEST', '3': 'UNDELIVERABLE' };
    const cancelReason = reasonMap[reason?.trim()] || 'OUT_OF_STOCK';
    setCancelLoading(true);
    try {
      const result = await shopeeApiProxy({ action: 'cancelOrder', shopId, params: { orderSn: actualOrderSn, cancelReason } });
      const res = result.data?.result || result.data || {};
      if (res.error) { alert('취소 실패: ' + (res.message || res.error)); }
      else { alert('주문이 취소되었습니다'); loadOrderDetail(); }
    } catch (e) { alert('취소 실패: ' + e.message); }
    finally { setCancelLoading(false); }
  };

  const goToChat = () => {
    router.push(`/chat?shopId=${shopId}&buyerId=${order?.buyer_user_id || ''}&orderSn=${encodeURIComponent(order?.order_sn || '')}&buyerName=${encodeURIComponent(order?.buyer_username || '')}`);
  };

  if (!user) return null;

  return (
    <div style={{fontFamily:'-apple-system,sans-serif',paddingBottom:80}}>
      <div className="header">
        <button onClick={() => router.back()} style={{background:'none',border:'none',color:'white',fontSize:18,cursor:'pointer'}}>← 뒤로</button>
        <span>주문 상세</span>
        <div style={{width:40}}></div>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:40}}><div className="spinner"></div></div>
      ) : error ? (
        <div style={{margin:12,padding:16,background:'#ffebee',borderRadius:8,color:'#c62828'}}>{error}</div>
      ) : order ? (
        <div style={{padding:12}}>
          <div style={{background:'white',borderRadius:12,padding:16,marginBottom:12,boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <span style={{fontSize:14,fontWeight:'bold',color:'#333'}}>{order.order_sn}</span>
              <span style={{fontSize:12,padding:'3px 10px',borderRadius:10,
                background:order.order_status==='CANCELLED'?'#ffebee':order.order_status==='COMPLETED'?'#e8f5e9':'#e3f2fd',
                color:order.order_status==='CANCELLED'?'#c62828':order.order_status==='COMPLETED'?'#2e7d32':'#1565c0'}}>
                {STATUS_LABELS[order.order_status] || order.order_status}
              </span>
            </div>
            <div style={{fontSize:13,color:'#666',lineHeight:1.8}}>
              <div>🏪 {shopName || shopId}</div>
              <div>👤 {order.buyer_username || '-'}</div>
              {order.tracking_number && <div>🚚 {order.tracking_number}</div>}
              {order.shipping_carrier && <div>📮 {order.shipping_carrier}</div>}
              <div>💰 총액: <strong>{currency}{order.total_amount || '-'}</strong></div>
              {order.pay_time && <div>💳 결제: {new Date(order.pay_time * 1000).toLocaleDateString('ko-KR')} {new Date(order.pay_time * 1000).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</div>}
            </div>
          </div>

          {order.recipient_address && (
            <div style={{background:'white',borderRadius:12,padding:16,marginBottom:12,boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
              <div style={{fontWeight:'bold',fontSize:14,marginBottom:8}}>📍 배송 주소</div>
              <div style={{fontSize:13,color:'#666',lineHeight:1.6}}>
                <div>{order.recipient_address.name} · {order.recipient_address.phone}</div>
                <div>{order.recipient_address.full_address}</div>
              </div>
            </div>
          )}

          <div style={{background:'white',borderRadius:12,padding:16,marginBottom:12,boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
            <div style={{fontWeight:'bold',fontSize:14,marginBottom:12}}>🛍️ 상품 ({order.item_list?.length || 0}개)</div>
            {(order.item_list || []).map((item, i) => {
              const stockKey = item.model_id ? `${item.item_id}_${item.model_id}` : item.item_id;
              const currentStock = itemStocks[stockKey]?.stock ?? itemStocks[item.item_id]?.total ?? '-';
              return (
                <div key={i} style={{display:'flex',gap:12,padding:'12px 0',borderBottom:i<(order.item_list?.length||1)-1?'1px solid #f5f5f5':'none'}}>
                  <div style={{width:70,height:70,borderRadius:8,overflow:'hidden',flexShrink:0,background:'#f5f5f5'}}>
                    {item.image_info?.image_url ? (
                      <img src={item.image_info.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{ e.target.style.display='none'; }} />
                    ) : (
                      <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>📦</div>
                    )}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:'bold',marginBottom:4,lineHeight:1.3}}>{item.item_name}</div>
                    {item.model_name && <div style={{fontSize:11,color:'#999',marginBottom:4}}>옵션: {item.model_name}</div>}
                    <div style={{fontSize:12,color:'#666',display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span>수량: {item.model_quantity_purchased || item.quantity || 1}</span>
                      <span style={{fontWeight:'bold',color:'#ee4d2d'}}>{currency}{item.model_discounted_price || item.model_original_price || '-'}</span>
                    </div>
                    <div style={{fontSize:11,color:'#888',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>현재고: <strong style={{color:currentStock<=0?'#c62828':currentStock<=5?'#e65100':'#2e7d32'}}>{currentStock}</strong></span>
                      <button
                        onClick={() => { setStockModal({ item_id: item.item_id, model_id: item.model_id, item_name: item.item_name, model_name: item.model_name }); setNewStock(String(currentStock !== '-' ? currentStock : '')); }}
                        style={{padding:'3px 8px',fontSize:11,background:'#fff3e0',color:'#e65100',border:'1px solid #ffcc02',borderRadius:4,cursor:'pointer'}}
                      >📦 재고수정</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <button onClick={goToChat} style={{flex:1,padding:'12px',background:'#ee4d2d',color:'white',border:'none',borderRadius:8,fontSize:14,cursor:'pointer',fontWeight:'bold'}}>💬 채팅</button>
            <button onClick={() => router.push('/scan')} style={{flex:1,padding:'12px',background:'white',color:'#ee4d2d',border:'1px solid #ee4d2d',borderRadius:8,fontSize:14,cursor:'pointer'}}>📷 스캔</button>
          </div>

          {['UNPAID','READY_TO_SHIP','PROCESSED'].includes(order.order_status) && (
            <button onClick={handleCancelOrder} disabled={cancelLoading}
              style={{width:'100%',padding:'12px',background:'white',color:'#c62828',border:'1px solid #c62828',borderRadius:8,fontSize:14,cursor:'pointer'}}>
              {cancelLoading ? '취소 처리중...' : '❌ 주문 취소'}
            </button>
          )}
        </div>
      ) : null}

      {stockModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
          <div style={{background:'white',borderRadius:12,padding:20,width:'100%',maxWidth:360}}>
            <div style={{fontWeight:'bold',fontSize:16,marginBottom:4}}>📦 재고 수정</div>
            <div style={{fontSize:12,color:'#666',marginBottom:12}}>
              {stockModal.item_name}
              {stockModal.model_name && <span style={{color:'#999'}}> · {stockModal.model_name}</span>}
            </div>
            <input type="number" placeholder="새 재고 수량" value={newStock} onChange={e => setNewStock(e.target.value)}
              style={{width:'100%',padding:'10px 12px',border:'1px solid #ddd',borderRadius:8,fontSize:14,marginBottom:12,boxSizing:'border-box'}} />
            {(stockResult || globalStockResult) && (
              <div style={{padding:8,borderRadius:6,marginBottom:12,background:(stockResult||globalStockResult).success?'#e8f5e9':'#ffebee',color:(stockResult||globalStockResult).success?'#2e7d32':'#c62828',fontSize:13}}>
                {(stockResult||globalStockResult).message}
              </div>
            )}
            <div style={{display:'flex',gap:8}}>
              <button onClick={() => { setStockModal(null); setNewStock(''); setStockResult(null); setGlobalStockResult(null); }}
                style={{flex:1,padding:'10px',background:'#f5f5f5',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>취소</button>
              <button onClick={() => handleUpdateStock(false)} disabled={stockLoading}
                style={{flex:1,padding:'10px',background:'#1565c0',color:'white',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>
                {stockLoading ? '처리중...' : '이 샵만'}
              </button>
              <button onClick={() => handleUpdateStock(true)} disabled={globalStockLoading}
                style={{flex:1,padding:'10px',background:'#ee4d2d',color:'white',border:'none',borderRadius:8,fontSize:13,cursor:'pointer'}}>
                {globalStockLoading ? '처리중...' : '🌐 글로벌'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="orders" />
    </div>
  );
}

export default function OrderDetailContent({ orderSn }) {
  return (
    <Suspense fallback={<div style={{textAlign:'center',padding:40}}><div className="spinner"></div></div>}>
      <OrderDetail orderSn={orderSn} />
    </Suspense>
  );
}
