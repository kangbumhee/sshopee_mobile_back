'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthChange, shopeeApiProxy } from '../../lib/firebase';
import { playCoinSound, playFailSound } from '../../lib/sounds';
import BottomNav from '../../components/BottomNav';

const REGION_FLAGS = {
  SG:'🇸🇬',MY:'🇲🇾',PH:'🇵🇭',TH:'🇹🇭',TW:'🇹🇼',VN:'🇻🇳',BR:'🇧🇷',MX:'🇲🇽',ID:'🇮🇩',
  sg:'🇸🇬',my:'🇲🇾',ph:'🇵🇭',th:'🇹🇭',tw:'🇹🇼',vn:'🇻🇳',br:'🇧🇷',mx:'🇲🇽',id:'🇮🇩',
};
const STATUS_LABELS = {
  UNPAID:'미결제',READY_TO_SHIP:'발송대기',PROCESSED:'처리중',SHIPPED:'배송중',
  COMPLETED:'완료',IN_CANCEL:'취소중',CANCELLED:'취소됨',INVOICE_PENDING:'인보이스 대기',
};
const getCurrency = (r) => ({SG:'S$',MY:'RM',PH:'₱',TH:'฿',TW:'NT$',VN:'₫',BR:'R$',MX:'MX$',ID:'Rp'}[(r||'').toUpperCase()] || '$');

function ScanResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tracking = searchParams.get('tracking');
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTime, setSearchTime] = useState(0);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderItemStocks, setOrderItemStocks] = useState({});
  const [previewImages, setPreviewImages] = useState(null);

  useEffect(() => {
    const unsub = onAuthChange((u) => { setUser(u); if (!u) router.push('/login'); });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (user && tracking) searchByTracking(tracking);
  }, [user, tracking]);

  const searchByTracking = async (trackingNumber) => {
    try {
      setLoading(true); setError('');
      const startTime = Date.now();

      let foundOrders = [];
      try {
        const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
        const { getAuth } = await import('firebase/auth');
        const firestore = getFirestore();
        const auth = getAuth();
        const currentUid = auth.currentUser?.uid;

        if (currentUid) {
          const ordersRef = collection(firestore, 'users', currentUid, 'orders');
          const q = query(ordersRef, where('tracking_number', '==', trackingNumber));
          const snap = await getDocs(q);

          if (snap.size === 0) {
            const q2 = query(ordersRef, where('order_sn', '==', trackingNumber));
            const snap2 = await getDocs(q2);
            snap2.forEach(doc => foundOrders.push(doc.data()));
          } else {
            snap.forEach(doc => foundOrders.push(doc.data()));
          }
        }
      } catch (e) {
        console.log('Firestore search error:', e.message);
      }

      if (foundOrders.length === 0) {
        const result = await shopeeApiProxy({ action: 'searchByTracking', params: { trackingNumber } });
        foundOrders = result.data?.orders || result.data?.result?.orders || [];
      }

      setSearchTime(((Date.now() - startTime) / 1000).toFixed(1));
      setOrders(foundOrders);
      if (foundOrders.length > 0) {
        foundOrders.some(o => o.is_cancelled) ? playFailSound() : playCoinSound();
        if (foundOrders.length === 1) handleOrderClick(foundOrders[0]);
      }
    } catch (e) { setError('검색 실패: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleOrderClick = async (order) => {
    if (expandedOrder === order.order_sn) { setExpandedOrder(null); setOrderDetail(null); return; }
    setExpandedOrder(order.order_sn);
    setOrderDetail(null);
    setOrderDetailLoading(true);
    try {
      if (order.item_list && order.item_list.length > 0) {
        setOrderDetail(order);
        try {
          const itemIds = [...new Set(order.item_list.map(it => it.item_id))];
          const stockResult = await shopeeApiProxy({
            action: 'getItemBaseInfo',
            shopId: order.shop_id,
            params: { itemIds }
          });
          const stocks = {};
          (stockResult.data?.items || []).forEach(item => {
            if (item.stock_info_v2?.summary_info) stocks[item.item_id] = { total: item.stock_info_v2.summary_info.total_available_stock ?? '-' };
            if (item.model_list) item.model_list.forEach(m => {
              stocks[`${item.item_id}_${m.model_id}`] = { stock: m.stock_info_v2?.summary_info?.total_available_stock ?? m.normal_stock ?? '-' };
            });
          });
          setOrderItemStocks(stocks);
        } catch (e) {}
        setOrderDetailLoading(false);
        return;
      }

      const result = await shopeeApiProxy({
        action: 'getOrderDetail',
        shopId: order.shop_id,
        params: { orderSnList: [order.order_sn] }
      });
      const orderList = result.data?.response?.order_list || [];
      const detail = orderList[0] || null;
      setOrderDetail(detail);
      if (detail?.item_list?.length > 0) {
        try {
          const itemIds = [...new Set(detail.item_list.map(it => it.item_id))];
          const stockResult = await shopeeApiProxy({
            action: 'getItemBaseInfo',
            shopId: order.shop_id,
            params: { itemIds }
          });
          const stocks = {};
          (stockResult.data?.items || []).forEach(item => {
            if (item.stock_info_v2?.summary_info) stocks[item.item_id] = { total: item.stock_info_v2.summary_info.total_available_stock ?? '-' };
            if (item.model_list) item.model_list.forEach(m => {
              stocks[`${item.item_id}_${m.model_id}`] = { stock: m.stock_info_v2?.summary_info?.total_available_stock ?? m.normal_stock ?? '-' };
            });
          });
          setOrderItemStocks(stocks);
        } catch (e) {}
      }
    } catch (e) { setOrderDetail(null); }
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

  if (!user) return null;

  return (
    <div style={{fontFamily:'-apple-system,sans-serif'}}>
      <div className="header">
        <button onClick={() => router.push('/scan')} style={{background:'none',border:'none',color:'white',fontSize:'18px',cursor:'pointer'}}>
          ← 다시 스캔
        </button>
        <span>검색 결과</span>
        <div style={{width:'40px'}}></div>
      </div>

      <div className="card" style={{margin:'12px'}}>
        <div style={{fontSize:'12px',color:'#999'}}>검색어 (트래킹/주문번호)</div>
        <div style={{fontSize:'16px',fontWeight:'bold',wordBreak:'break-all'}}>{tracking}</div>
        {!loading && <div style={{fontSize:'11px',color:'#999',marginTop:'4px'}}>검색시간: {searchTime}초 · 결과: {orders.length}건</div>}
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:'40px'}}>
          <div className="spinner" style={{margin:'0 auto 16px'}}></div>
          <div style={{color:'#666',fontSize:'14px'}}>검색 중...</div>
        </div>
      ) : error ? (
        <div className="card" style={{margin:'12px',color:'red'}}>{error}</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🔍</div>
          <p>주문을 찾을 수 없습니다</p>
          <button className="btn" onClick={() => router.push('/scan')} style={{maxWidth:'200px',margin:'16px auto'}}>다시 스캔</button>
        </div>
      ) : (
        <div style={{padding:'0 12px'}}>
          {orders.map((order) => {
            const isExpanded = expandedOrder === order.order_sn;
            const currency = getCurrency(order.region);
            const items = order.item_list || [];
            const firstItem = items[0] || {};
            const totalQty = items.reduce((sum, it) => sum + (it.model_quantity_purchased || it.quantity || 1), 0);

            return (
              <div key={order.order_sn} style={{marginBottom:8,borderRadius:10,overflow:'hidden',
                background:order.is_cancelled?'#fff0f0':'white',
                border:order.is_cancelled?'2px solid #f44336':'1px solid #eee'}}>

                {order.is_cancelled && (
                  <div style={{color:'#f44336',fontWeight:'bold',fontSize:13,padding:'8px 16px 0'}}>⚠️ 취소된 주문입니다</div>
                )}

                <div onClick={() => handleOrderClick(order)}
                  style={{display:'flex',gap:10,padding:'12px 16px',cursor:'pointer',alignItems:'center',background:isExpanded?'#fff8f0':'transparent'}}>
                  <div style={{position:'relative',width:50,height:50,flexShrink:0}}
                    onClick={(e) => { e.stopPropagation(); openImagePreview(items, 0); }}>
                    {firstItem.image_info?.image_url ? (
                      <img src={firstItem.image_info.image_url} alt="" style={{width:50,height:50,borderRadius:6,objectFit:'cover',cursor:'zoom-in'}} onError={e=>e.target.style.display='none'} />
                    ) : (
                      <div style={{width:50,height:50,borderRadius:6,background:'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📦</div>
                    )}
                    {items.length > 1 && (
                      <div style={{position:'absolute',top:-4,right:-4,background:'#ee4d2d',color:'white',borderRadius:'50%',width:18,height:18,fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'bold'}}>{items.length}</div>
                    )}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                      <span>{REGION_FLAGS[order.region]||'🌐'}</span>
                      <span style={{fontSize:13,fontWeight:'bold'}}>{order.shop_name}</span>
                      <span style={{fontSize:10,padding:'1px 6px',borderRadius:8,
                        background:order.order_status==='COMPLETED'?'#e8f5e9':order.order_status==='SHIPPED'?'#e3f2fd':'#fff3e0',
                        color:order.order_status==='COMPLETED'?'#2e7d32':order.order_status==='SHIPPED'?'#1565c0':'#e65100'}}>
                        {STATUS_LABELS[order.order_status]||order.order_status}
                      </span>
                    </div>
                    <div style={{fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{firstItem.item_name || order.order_sn}</div>
                    <div style={{fontSize:11,color:'#888',marginTop:2}}>{order.order_sn} · 수량 {totalQty}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:'bold',color:'#ee4d2d'}}>{currency}{order.total_amount || '-'}</div>
                    <div style={{fontSize:10,color:'#999'}}>{isExpanded ? '▲' : '▼'}</div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{padding:'0 16px 16px',borderTop:'1px solid #f0f0f0'}}>
                    {orderDetailLoading ? (
                      <div style={{textAlign:'center',padding:16,color:'#999',fontSize:13}}>상세 로딩중...</div>
                    ) : orderDetail ? (
                      <div>
                        <div style={{fontSize:12,color:'#666',lineHeight:1.8,marginTop:12,marginBottom:12,padding:'8px 12px',background:'#f9f9f9',borderRadius:8}}>
                          <div>👤 {orderDetail.buyer_username || '-'}</div>
                          {orderDetail.tracking_number && <div>🚚 {orderDetail.tracking_number}</div>}
                          {orderDetail.shipping_carrier && <div>📮 {orderDetail.shipping_carrier}</div>}
                          <div>💰 총액: <strong>{currency}{orderDetail.total_amount || '-'}</strong></div>
                          {orderDetail.pay_time && <div>💳 결제: {new Date(orderDetail.pay_time*1000).toLocaleDateString('ko-KR')} {new Date(orderDetail.pay_time*1000).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</div>}
                        </div>

                        <div style={{marginBottom:12}}>
                          <div style={{fontWeight:'bold',fontSize:13,marginBottom:8}}>📋 주문품 상세</div>
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
                                    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📦</div>
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
                          {orderDetail.buyer_user_id != null && (
                            <button onClick={() => router.push(`/chat?shopId=${order.shop_id}&buyerId=${orderDetail.buyer_user_id}&orderSn=${encodeURIComponent(order.order_sn)}&buyerName=${encodeURIComponent(orderDetail.buyer_username||'')}`)}
                              style={{flex:1,padding:'8px',background:'#ee4d2d',color:'white',border:'none',borderRadius:6,fontSize:12,cursor:'pointer'}}>💬 채팅</button>
                          )}
                          <button onClick={() => router.push(`/order/${order.order_sn}?shopId=${order.shop_id}&shopName=${encodeURIComponent(order.shop_name||'')}&region=${order.region}`)}
                            style={{flex:1,padding:'8px',background:'white',color:'#ee4d2d',border:'1px solid #ee4d2d',borderRadius:6,fontSize:12,cursor:'pointer'}}>📋 전체보기</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{textAlign:'center',padding:16,color:'#999',fontSize:13}}>상세 정보를 불러올 수 없습니다</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
                  const next = diff < 0 ? (prev.currentIndex + 1) % len : (prev.currentIndex - 1 + len) % len;
                  return { ...prev, currentIndex: next };
                });
              }
            }}
            onClick={(e) => e.stopPropagation()}>
            {previewImages.images.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); setPreviewImages(prev => prev && ({...prev, currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length})); }}
                style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',background:'rgba(255,255,255,0.2)',border:'none',color:'white',fontSize:28,borderRadius:'50%',width:40,height:40,cursor:'pointer',zIndex:2,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
            )}
            <img src={previewImages.images[previewImages.currentIndex].url} alt="" style={{maxWidth:'80vw',maxHeight:'55vh',objectFit:'contain',borderRadius:8}} />
            <div style={{position:'absolute',bottom:12,right:'12%',background:'rgba(238,77,45,0.9)',color:'white',borderRadius:14,padding:'3px 12px',fontSize:14,fontWeight:'bold'}}>
              x{previewImages.images[previewImages.currentIndex].qty}
            </div>
            {previewImages.images.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); setPreviewImages(prev => prev && ({...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length})); }}
                style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'rgba(255,255,255,0.2)',border:'none',color:'white',fontSize:28,borderRadius:'50%',width:40,height:40,cursor:'pointer',zIndex:2,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
            )}
          </div>
          <div style={{color:'white',fontSize:12,marginTop:8,textAlign:'center',padding:'0 20px',maxWidth:'90vw',flexShrink:0}}>
            <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{previewImages.images[previewImages.currentIndex].name}</div>
            {previewImages.images[previewImages.currentIndex].option && (
              <div style={{color:'#ccc',fontSize:11,marginTop:2}}>옵션: {previewImages.images[previewImages.currentIndex].option}</div>
            )}
          </div>
          {previewImages.images.length > 1 && (
            <div onClick={(e) => e.stopPropagation()}
              style={{marginTop:12,width:'100%',maxWidth:'90vw',overflowX:'auto',overflowY:'hidden',flexShrink:0,WebkitOverflowScrolling:'touch'}}>
              <div style={{display:'inline-flex',gap:6,padding:'4px 8px',minWidth:'100%',justifyContent:previewImages.images.length<=5?'center':'flex-start'}}>
                {previewImages.images.map((img, idx) => (
                  <div key={idx} onClick={(e) => { e.stopPropagation(); setPreviewImages(prev => ({...prev, currentIndex: idx})); }}
                    style={{position:'relative',width:48,height:48,borderRadius:6,overflow:'hidden',flexShrink:0,
                      border:idx===previewImages.currentIndex?'2px solid #ee4d2d':'2px solid rgba(255,255,255,0.3)',
                      cursor:'pointer',opacity:idx===previewImages.currentIndex?1:0.6}}>
                    <img src={img.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    <div style={{position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,0.65)',color:'white',fontSize:9,textAlign:'center',padding:'1px 0'}}>x{img.qty}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{color:'#666',fontSize:11,marginTop:12,flexShrink:0}}>바깥 영역을 터치하면 닫힙니다</div>
        </div>
      )}

      <BottomNav active="scan" />
    </div>
  );
}

export default function ScanResultPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner"></div></div>}>
      <ScanResultContent />
    </Suspense>
  );
}
