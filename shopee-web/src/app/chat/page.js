'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthChange, shopeeApiProxy } from '../../lib/firebase';
import { play1UpSound } from '../../lib/sounds';
import BottomNav from '../../components/BottomNav';

const REGION_FLAGS = { SG:'🇸🇬', MY:'🇲🇾', PH:'🇵🇭', TH:'🇹🇭', TW:'🇹🇼', VN:'🇻🇳', BR:'🇧🇷', MX:'🇲🇽', ID:'🇮🇩' };
const REGION_TABS = [
  { key: 'ALL', label: '전체' },
  { key: 'SG', label: '🇸🇬' }, { key: 'MY', label: '🇲🇾' },
  { key: 'VN', label: '🇻🇳' }, { key: 'PH', label: '🇵🇭' },
  { key: 'TH', label: '🇹🇭' }, { key: 'TW', label: '🇹🇼' },
  { key: 'BR', label: '🇧🇷' }, { key: 'MX', label: '🇲🇽' },
];
const REGION_LANG_MAP = { SG:'en', MY:'ms', PH:'en', TH:'th', TW:'zh-TW', VN:'vi', BR:'pt', MX:'es', ID:'id' };
const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'pinned', label: 'Pinned' },
  { key: 'closed', label: 'Closed' },
];

const formatChatTime = (ts) => {
  if (!ts) return '';
  let num = Number(ts);
  if (num === 0 || isNaN(num)) return '';
  if (num > 9999999999999) num = Math.floor(num / 1000000);
  else if (num < 9999999999) num = num * 1000;
  const d = new Date(num);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  if (today.getTime() === msgDay.getTime()) return time;
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return (d.getMonth()+1) + '/' + d.getDate();
};

const formatMsgTime = (ts) => {
  if (!ts) return '';
  let num = Number(ts);
  if (num === 0 || isNaN(num)) return '';
  if (num > 9999999999999) num = Math.floor(num / 1000000);
  else if (num < 9999999999) num = num * 1000;
  const d = new Date(num);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  if (today.getTime() === msgDay.getTime()) return time;
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday ' + time;
  return (d.getMonth()+1) + '/' + d.getDate() + ' ' + time;
};

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initShopId = searchParams.get('shopId');
  const initToId = searchParams.get('buyerId') || searchParams.get('toId');
  const initOrderSn = searchParams.get('orderSn');
  const initToName = searchParams.get('buyerName') ? decodeURIComponent(searchParams.get('buyerName')) : '구매자';

  const [user, setUser] = useState(null);
  const [view, setView] = useState('list');
  const [conversations, setConversations] = useState([]);
  const [filteredConvs, setFilteredConvs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [hasMoreConvs, setHasMoreConvs] = useState(false);
  const [nextShopIndex, setNextShopIndex] = useState(0);
  const [hasMoreMsgs, setHasMoreMsgs] = useState(false);
  const [selectedConv, setSelectedConv] = useState(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeRegion, setActiveRegion] = useState('ALL');
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [longPressConv, setLongPressConv] = useState(null);
  const [orderInfo, setOrderInfo] = useState(null);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [translations, setTranslations] = useState({});
  const messagesEndRef = useRef(null);
  const listScrollRef = useRef(0);
  const longPressTimer = useRef(null);
  const conversationsCache = useRef([]);
  const unreadTotalRef = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem('shopee_chat_filter');
    if (saved && FILTER_TABS.find(t => t.key === saved)) setActiveFilter(saved);
  }, []);

  const sortConvs = (convs) => {
    return [...convs].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const tsA = String(a.last_message_timestamp || a._ts_str || '0').padStart(20, '0');
      const tsB = String(b.last_message_timestamp || b._ts_str || '0').padStart(20, '0');
      return tsB.localeCompare(tsA);
    });
  };

  const applyFilter = (filter, convs, region) => {
    let filtered = convs;
    const r = region || activeRegion;
    if (r && r !== 'ALL') {
      filtered = filtered.filter(c => (c._region || '').toUpperCase() === r);
    }
    if (filter === 'closed') {
      filtered = filtered.filter(c =>
        c.last_message_option === 0 ||
        (c.latest_message_content?.text || c.last_message_content?.text || '').includes('has ended') ||
        (c.latest_message_content?.text || c.last_message_content?.text || '').includes('automatically closed')
      );
    }
    setFilteredConvs(filtered);
  };

  useEffect(() => {
    applyFilter(activeFilter, conversations, activeRegion);
  }, [activeFilter, activeRegion, conversations]);

  useEffect(() => {
    if (view === 'conversation') {
      document.body.style.paddingBottom = '0px';
      document.body.style.minHeight = 'auto';
    } else {
      document.body.style.paddingBottom = '70px';
      document.body.style.minHeight = '100vh';
    }
    return () => {
      document.body.style.paddingBottom = '70px';
      document.body.style.minHeight = '100vh';
    };
  }, [view]);

  useEffect(() => {
    const unsub = onAuthChange(u => { setUser(u); if (!u) router.push('/login'); });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (user) {
      if (conversationsCache.current.length > 0 && activeFilter === 'all') {
        setConversations(conversationsCache.current);
        setLoading(false);
      } else {
        loadConversations(true, activeFilter === 'closed' ? 'all' : activeFilter);
      }
      loadUnreadCount();
      if (initShopId && initToId) openDirectConversation(initShopId, initToId, initOrderSn);
    }
  }, [user]);

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    localStorage.setItem('shopee_chat_filter', filter);
    if (filter === 'closed') {
      applyFilter('closed', conversations);
    } else {
      loadConversations(true, filter);
    }
  };

  const handleRegionChange = (region) => {
    setActiveRegion(region);
  };

  const loadConversations = async (initial = false, filterType = 'all') => {
    if (initial) { setLoading(true); setConversations([]); } else setLoadingMore(true);
    try {
      const idx = initial ? 0 : nextShopIndex;
      const result = await shopeeApiProxy({
        action: 'getAllConversations',
        params: { pageSize: 20, shopIndex: idx, filterType: filterType === 'closed' ? 'all' : filterType }
      });
      const convs = result.data?.conversations || [];
      let updated;
      if (initial) { updated = sortConvs(convs); }
      else {
        const ids = new Set(conversations.map(c => c.conversation_id));
        const newConvs = convs.filter(c => !ids.has(c.conversation_id));
        updated = sortConvs([...conversations, ...newConvs]);
      }
      setConversations(updated);
      conversationsCache.current = updated;
      setHasMoreConvs(result.data?.hasMore || false);
      setNextShopIndex(result.data?.nextShopIndex ?? 0);
    } catch (e) { console.error('대화 로드 실패:', e); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  const loadUnreadCount = async () => {
    try {
      const result = await shopeeApiProxy({ action: 'getUnreadCounts', params: {} });
      const newCount = result.data?.totalUnread || 0;
      if (newCount > unreadTotalRef.current) play1UpSound();
      unreadTotalRef.current = newCount;
      setUnreadTotal(newCount);
    } catch (e) {}
  };

  const loadOrderInfoForConv = async (conv) => {
    try {
      const result = await shopeeApiProxy({
        action: 'getOrdersByBuyer',
        shopId: conv._shop_id,
        params: { buyerId: conv.to_id }
      });
      if (result.data?.orders?.length > 0) {
        setOrderInfo(result.data.orders[0]);
      }
    } catch (e) {
      try {
        const now = Math.floor(Date.now() / 1000);
        const result = await shopeeApiProxy({
          action: 'getOrdersByStatus',
          shopId: conv._shop_id,
          params: { timeFrom: now - 60 * 86400, timeTo: now, pageSize: 50, orderStatus: 'READY_TO_SHIP' }
        });
        const orders = result.data?.orders || [];
        const match = orders.find(o => o.buyer_user_id === conv.to_id || o.buyer_username === conv.to_name);
        if (match) setOrderInfo(match);
      } catch (e2) {}
    }
  };

  const openConversation = async (conv) => {
    listScrollRef.current = document.querySelector('#chat-list-scroll')?.scrollTop || 0;
    setSelectedConv(conv); setView('conversation'); setMessages([]); setMsgLoading(true);
    setLongPressConv(null); setOrderInfo(null); setShowOrderPanel(true);
    try {
      shopeeApiProxy({ action: 'readConversation', shopId: conv._shop_id, params: { conversationId: conv.conversation_id } }).catch(() => {});
      setConversations(prev => {
        const updated = prev.map(c => c.conversation_id === conv.conversation_id ? { ...c, unread_count: 0 } : c);
        conversationsCache.current = updated;
        return updated;
      });

      const result = await shopeeApiProxy({ action: 'getChatMessages', shopId: conv._shop_id, params: { conversationId: conv.conversation_id, pageSize: 25, direction: 'latest' } });
      const msgs = result.data?.response?.messages || result.data?.messages || [];
      setMessages(msgs.reverse());
      setHasMoreMsgs(result.data?.response?.more || false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

      loadOrderInfoForConv(conv);
    } catch (e) { console.error('메시지 로드 실패:', e); }
    finally { setMsgLoading(false); }
  };

  const openDirectConversation = async (shopId, toId, orderSn) => {
    setView('conversation'); setMsgLoading(true);
    setSelectedConv({ _shop_id: shopId, to_id: Number(toId), to_name: initToName, _region: '', _shop_name: '', conversation_id: null, _orderSn: orderSn });
    try {
      const result = await shopeeApiProxy({ action: 'getChatConversations', shopId, params: { pageSize: 50 } });
      const convs = result.data?.response?.conversations || [];
      const match = convs.find(c => c.to_id === Number(toId));
      if (match) {
        setSelectedConv(prev => ({ ...prev, ...match, _shop_id: shopId, _orderSn: orderSn }));
        const msgResult = await shopeeApiProxy({ action: 'getChatMessages', shopId, params: { conversationId: match.conversation_id, pageSize: 25, direction: 'latest' } });
        const msgs = msgResult.data?.response?.messages || [];
        setMessages(msgs.reverse());
        setHasMoreMsgs(msgResult.data?.response?.more || false);
      }
    } catch (e) {}
    finally { setMsgLoading(false); }
  };

  const goBackToList = () => {
    setView('list');
    setSelectedConv(null);
    setOrderInfo(null);
    setShowOrderPanel(false);
    setTimeout(() => {
      const el = document.querySelector('#chat-list-scroll');
      if (el) el.scrollTop = listScrollRef.current;
    }, 50);
  };

  const loadMoreMessages = async () => {
    if (!hasMoreMsgs || msgLoading || !selectedConv?.conversation_id) return;
    setMsgLoading(true);
    try {
      const oldestMsg = messages[0];
      const result = await shopeeApiProxy({ action: 'getChatMessages', shopId: selectedConv._shop_id, params: { conversationId: selectedConv.conversation_id, pageSize: 25, direction: 'older', offset: oldestMsg?.message_id } });
      const msgs = result.data?.response?.messages || [];
      setMessages(prev => [...msgs.reverse(), ...prev]);
      setHasMoreMsgs(result.data?.response?.more || false);
    } catch (e) {}
    finally { setMsgLoading(false); }
  };

  const isClosed = () => {
    if (!messages.length) return false;
    const last = messages[messages.length - 1];
    return last?.message_type === 'system' || (last?.content?.text || '').includes('automatically closed');
  };

  const restartConversation = () => {
    setInputText('Hi, I would like to follow up.');
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedConv || sending) return;
    setSending(true);
    let textToSend = inputText.trim();
    try {
      if (autoTranslate) {
        const targetLang = REGION_LANG_MAP[(selectedConv._region || '').toUpperCase()] || 'en';
        if (targetLang !== 'ko') {
          try {
            const tr = await shopeeApiProxy({ action: 'translateText', params: { text: textToSend, targetLang } });
            if (tr.data?.translatedText) textToSend = tr.data.translatedText;
          } catch (e) { /* 번역 실패 시 원문 전송 */ }
        }
      }
      const result = await shopeeApiProxy({
        action: 'sendChatMessage',
        shopId: selectedConv._shop_id,
        params: { toId: selectedConv.to_id, messageType: 'text', content: textToSend, orderSn: selectedConv._orderSn || undefined }
      });
      const res = result.data?.result || result.data || {};
      if (res.error || res.restricted || (res.message && res.message.includes('only message'))) {
        alert('⚠️ 메시지 발송 불가\n\n바이어가 7일 이내 대화를 시작했거나, 30일 이내 주문이 있거나, 미해결 반품/환불 건이 있어야 합니다.');
        return;
      }
      if (!res.error) {
        setInputText('');
        setMessages(prev => [...prev, { message_id: (res.response?.message_id || Date.now()).toString(), from_id: 0, to_id: selectedConv.to_id, message_type: 'text', content: { text: textToSend }, created_timestamp: Math.floor(Date.now() / 1000), _sent: true, _read: false }]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        alert('발송 실패: ' + (res.message || res.error));
      }
    } catch (e) { alert('발송 실패: ' + (e.message || '알 수 없는 오류')); }
    finally { setSending(false); }
  };

  const translateMessage = async (msgId, text) => {
    if (translations[msgId]) { setTranslations(prev => { const n = {...prev}; delete n[msgId]; return n; }); return; }
    try {
      const result = await shopeeApiProxy({ action: 'translateText', params: { text, targetLang: 'ko' } });
      const translated = result.data?.translatedText || result.data?.result?.translatedText || '번역 실패';
      setTranslations(prev => ({ ...prev, [msgId]: translated }));
    } catch (e) {
      setTranslations(prev => ({ ...prev, [msgId]: '번역 실패' }));
    }
  };

  useEffect(() => {
    if (showOrderPanel && selectedConv?._orderSn && selectedConv?._shop_id && !orderInfo) {
      shopeeApiProxy({ action: 'getOrderDetail', shopId: selectedConv._shop_id, params: { orderSnList: selectedConv._orderSn } })
        .then(r => {
          const list = r.data?.response?.order_list || r.data?.order_list;
          setOrderInfo(list?.[0] || null);
        })
        .catch(() => setOrderInfo(null));
    }
  }, [showOrderPanel, selectedConv?._orderSn, selectedConv?._shop_id]);

  const handleTouchStart = (conv) => { longPressTimer.current = setTimeout(() => setLongPressConv(conv.conversation_id), 500); };
  const handleTouchEnd = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); longPressTimer.current = null; };

  const handleAction = async (actionName, conv) => {
    setLongPressConv(null);
    if (actionName === 'pin') await shopeeApiProxy({ action: 'pinConversation', shopId: conv._shop_id, params: { conversationId: conv.conversation_id } });
    if (actionName === 'unpin') await shopeeApiProxy({ action: 'unpinConversation', shopId: conv._shop_id, params: { conversationId: conv.conversation_id } });
    if (actionName === 'mute') await shopeeApiProxy({ action: 'muteConversation', shopId: conv._shop_id, params: { conversationId: conv.conversation_id } });
    if (actionName === 'unread') await shopeeApiProxy({ action: 'unreadConversation', shopId: conv._shop_id, params: { conversationId: conv.conversation_id } });
    if (actionName === 'delete') { if (!confirm('대화를 삭제하시겠습니까?')) return; await shopeeApiProxy({ action: 'deleteConversation', shopId: conv._shop_id, params: { conversationId: conv.conversation_id } }); }
    loadConversations(true);
    loadUnreadCount();
  };

  const renderMessageContent = (msg) => {
    const type = msg.message_type;
    const content = msg.content || {};
    if (type === 'text') return <span style={{whiteSpace:'pre-wrap'}}>{content.text || ''}</span>;
    if (type === 'image') return <img src={content.image_url || content.url} alt="" style={{maxWidth:200,borderRadius:8}} onError={e => { e.target.style.display='none'; }} />;
    if (type === 'sticker') return <img src={content.sticker_url || content.url} alt="" style={{width:80}} />;
    if (type === 'item') return <div style={{background:'#f5f5f5',padding:8,borderRadius:8,fontSize:12}}>🛍️ 상품 공유</div>;
    if (type === 'order') return <div style={{background:'#f5f5f5',padding:8,borderRadius:8,fontSize:12}}>📦 주문: {content.order_sn}</div>;
    if (type === 'system') return <div style={{textAlign:'center',color:'#999',fontSize:12,padding:'8px 0'}}>{content.text || ''}</div>;
    return <span style={{color:'#999',fontSize:12}}>[{type}]</span>;
  };

  if (!user) return null;

  if (view === 'conversation' && selectedConv) {
    const closed = isClosed();
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100vh',maxWidth:500,margin:'0 auto',fontFamily:'-apple-system,sans-serif',overflow:'hidden'}}>
        <div style={{background:'linear-gradient(135deg,#ee4d2d,#ff6633)',color:'white',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
          <button onClick={goBackToList} style={{background:'none',border:'none',color:'white',fontSize:20,cursor:'pointer',padding:4}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:'bold'}}>{selectedConv.to_name || '구매자'}</div>
            <div style={{fontSize:11,opacity:0.8}}>{REGION_FLAGS[selectedConv._region] || ''} {selectedConv._shop_name}</div>
          </div>
          <button onClick={() => setShowOrderPanel(!showOrderPanel)} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'white',padding:'4px 10px',borderRadius:6,fontSize:12,cursor:'pointer'}}>📦 주문</button>
        </div>

        {showOrderPanel && (
          <div style={{background:'#fff',borderBottom:'1px solid #eee',padding:12,fontSize:12,flexShrink:0,maxHeight:150,overflowY:'auto'}}>
            {orderInfo ? (
              <>
                <div style={{fontWeight:'bold',marginBottom:4}}>📦 {orderInfo.order_sn}</div>
                <div>상태: <span style={{color:orderInfo.order_status==='CANCELLED'?'#c62828':'#2e7d32'}}>{orderInfo.order_status}</span></div>
                {(orderInfo.item_list || []).map((item, i) => (
                  <div key={i} style={{display:'flex',gap:8,marginTop:4,alignItems:'center'}}>
                    {(item.image_info?.image_url || item.image_url) && <img src={item.image_info?.image_url || item.image_url} alt="" style={{width:32,height:32,borderRadius:4}} />}
                    <span>{item.item_name} x{item.model_quantity_purchased}</span>
                  </div>
                ))}
                {orderInfo.total_amount && <div style={{marginTop:4}}>총액: {orderInfo.total_amount}</div>}
              </>
            ) : selectedConv._orderSn ? (
              <div style={{color:'#999'}}>주문 정보 로딩중...</div>
            ) : (
              <div style={{color:'#999'}}>연결된 주문 없음</div>
            )}
          </div>
        )}

        <div style={{flex:1,overflowY:'auto',padding:'12px 16px',background:'#f0f0f0'}} onScroll={e => { if (e.target.scrollTop < 50 && hasMoreMsgs && !msgLoading) loadMoreMessages(); }}>
          {msgLoading && messages.length === 0 && <div style={{textAlign:'center',padding:40,color:'#999'}}>메시지 로딩중...</div>}
          {hasMoreMsgs && <div style={{textAlign:'center',padding:8}}><button onClick={loadMoreMessages} disabled={msgLoading} style={{background:'#e0e0e0',border:'none',borderRadius:16,padding:'6px 16px',fontSize:12,color:'#666',cursor:'pointer'}}>{msgLoading ? '로딩중...' : '이전 메시지'}</button></div>}
          {messages.map((msg, i) => {
            const isBuyer = msg.from_id === selectedConv.to_id;
            const isSystem = msg.message_type === 'system' || (msg.content?.text || '').includes('automatically closed') || (msg.content?.text || '').includes('joined the conversation');
            if (isSystem) {
              return <div key={msg.message_id || i} style={{textAlign:'center',color:'#999',fontSize:12,padding:'12px 0'}}>{msg.content?.text || ''}</div>;
            }
            return (
              <div key={msg.message_id || i} style={{display:'flex',justifyContent:isBuyer?'flex-start':'flex-end',marginBottom:8}}>
                <div style={{maxWidth:'75%'}}>
                  <div style={{padding:'10px 14px',borderRadius:isBuyer?'4px 16px 16px 16px':'16px 4px 16px 16px',background:isBuyer?'white':'#ee4d2d',color:isBuyer?'#333':'white',boxShadow:'0 1px 2px rgba(0,0,0,0.08)',fontSize:14}}>
                    {renderMessageContent(msg)}
                  </div>
                  <div style={{display:'flex',justifyContent:isBuyer?'flex-start':'flex-end',alignItems:'center',gap:4,marginTop:2}}>
                    <span style={{fontSize:10,color:'#999'}}>{formatMsgTime(msg.created_timestamp)}</span>
                    {!isBuyer && <span style={{fontSize:10,color:'#999'}}>{msg._read ? '✓✓' : '✓'}</span>}
                  </div>
                  {isBuyer && msg.message_type === 'text' && msg.content?.text && (
                    <div style={{marginTop:2}}>
                      <button onClick={() => translateMessage(msg.message_id, msg.content.text)} style={{background:'none',border:'none',color:'#1565c0',fontSize:11,cursor:'pointer',padding:0}}>
                        {translations[msg.message_id] ? '원문 보기' : '🌐 번역'}
                      </button>
                      {translations[msg.message_id] && <div style={{fontSize:12,color:'#555',marginTop:2,padding:'4px 8px',background:'#e3f2fd',borderRadius:6}}>{translations[msg.message_id]}</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {closed ? (
          <div style={{padding:'12px',background:'white',borderTop:'1px solid #eee',textAlign:'center',flexShrink:0}}>
            <button onClick={restartConversation} style={{border:'1px solid #ee4d2d',background:'white',color:'#ee4d2d',padding:'10px 24px',borderRadius:8,fontSize:14,cursor:'pointer'}}>
              💬 Restart Conversation
            </button>
          </div>
        ) : (
          <div style={{padding:'8px 12px',background:'white',borderTop:'1px solid #eee',display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
            <button onClick={() => setAutoTranslate(!autoTranslate)}
              style={{border:'none',background:autoTranslate?'#ee4d2d':'#ccc',color:'#fff',borderRadius:16,padding:'4px 10px',fontSize:11,cursor:'pointer',flexShrink:0}}>
              🌐 {autoTranslate ? 'ON' : 'OFF'}
            </button>
            <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={autoTranslate ? `한글 입력 → ${REGION_LANG_MAP[(selectedConv?._region || '').toUpperCase()] || 'en'} 자동번역` : '메시지 입력...'}
              style={{flex:1,padding:'10px 14px',border:'1px solid #ddd',borderRadius:20,fontSize:14,outline:'none'}} />
            <button onClick={sendMessage} disabled={sending || !inputText.trim()}
              style={{width:40,height:40,borderRadius:'50%',background:inputText.trim()?'#ee4d2d':'#ddd',border:'none',color:'white',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {sending ? '⏳' : '➤'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',maxWidth:500,margin:'0 auto',fontFamily:'-apple-system,sans-serif'}}>
      <div style={{background:'linear-gradient(135deg,#ee4d2d,#ff6633)',color:'white',padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <h1 style={{margin:0,fontSize:18}}>💬 채팅 {unreadTotal > 0 && <span style={{background:'#fff',color:'#ee4d2d',borderRadius:12,padding:'2px 8px',fontSize:12,marginLeft:8}}>{unreadTotal}</span>}</h1>
        <button onClick={() => loadConversations(true)} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'white',padding:'6px 12px',borderRadius:6,fontSize:13,cursor:'pointer'}}>🔄</button>
      </div>

      {/* 나라 선택 탭 */}
      <div style={{display:'flex',overflowX:'auto',borderBottom:'1px solid #eee',background:'#fff',flexShrink:0}}>
        {REGION_TABS.map(tab => (
          <button key={tab.key} onClick={() => handleRegionChange(tab.key)}
            style={{padding:'8px 12px',border:'none',borderBottom:activeRegion===tab.key?'2px solid #ee4d2d':'2px solid transparent',
              background:'none',color:activeRegion===tab.key?'#ee4d2d':'#666',fontSize:13,
              fontWeight:activeRegion===tab.key?'bold':'normal',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{display:'flex',borderBottom:'1px solid #eee',background:'#fff',flexShrink:0}}>
        {FILTER_TABS.map(tab => (
          <button key={tab.key} onClick={() => handleFilterChange(tab.key)}
            style={{flex:1,padding:'10px 0',border:'none',borderBottom:activeFilter===tab.key?'2px solid #ee4d2d':'2px solid transparent',
              background:'none',color:activeFilter===tab.key?'#ee4d2d':'#999',fontSize:13,fontWeight:activeFilter===tab.key?'bold':'normal',cursor:'pointer'}}>
            {tab.label}
            {tab.key === 'unread' && unreadTotal > 0 && <span style={{marginLeft:4,fontSize:11}}>({unreadTotal})</span>}
          </button>
        ))}
      </div>

      <div id="chat-list-scroll" style={{flex:1,overflowY:'auto'}}>
        {loading ? (
          <div style={{textAlign:'center',padding:40,color:'#999'}}>대화 로딩중...</div>
        ) : filteredConvs.length === 0 ? (
          <div style={{textAlign:'center',padding:40,color:'#999'}}>대화가 없습니다</div>
        ) : (
          <>
            {filteredConvs.map((conv, i) => {
              const lastMsg = conv.latest_message_content?.text || conv.last_message_content?.text || '';
              const isUnread = conv.unread_count > 0;
              const ts = conv.last_message_timestamp || conv.latest_message_timestamp;
              const convClosed = conv.status === 'closed' || lastMsg.includes('automatically closed');
              const isPinned = conv.pinned === true;
              return (
                <div key={conv.conversation_id || i} style={{position:'relative'}}>
                  <div
                    onClick={() => { if (!longPressConv) openConversation(conv); }}
                    onTouchStart={() => handleTouchStart(conv)}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={e => { e.preventDefault(); setLongPressConv(conv.conversation_id); }}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderBottom:'1px solid #f0f0f0',cursor:'pointer',background:isPinned?'#f5f5f5':isUnread?'#fff8f0':'white'}}
                  >
                    <div style={{width:48,height:48,borderRadius:'50%',background:'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0,overflow:'hidden'}}>
                      {conv.to_avatar ? <img src={conv.to_avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : '👤'}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontWeight:isUnread?'bold':'normal',fontSize:14}}>
                          {isPinned && '📌 '}{REGION_FLAGS[conv._region]||'🌐'} {conv.to_name || '알수없음'}
                        </span>
                        <span style={{fontSize:11,color:'#999',flexShrink:0}}>{formatChatTime(ts)}</span>
                      </div>
                      <div style={{fontSize:12,color:'#888',marginTop:3,display:'flex',alignItems:'center',gap:4}}>
                        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{conv._shop_name} · {lastMsg || '...'}</span>
                        {convClosed && <span style={{fontSize:10,color:'#999',background:'#f0f0f0',padding:'1px 6px',borderRadius:4,flexShrink:0}}>Closed</span>}
                      </div>
                    </div>
                    {isUnread && (
                      <div style={{minWidth:20,height:20,borderRadius:10,background:'#ee4d2d',color:'white',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,padding:'0 5px'}}>
                        {conv.unread_count > 99 ? '99+' : conv.unread_count}
                      </div>
                    )}
                  </div>

                  {longPressConv === conv.conversation_id && (
                    <div style={{position:'absolute',right:16,top:8,background:'white',borderRadius:10,boxShadow:'0 4px 16px rgba(0,0,0,0.18)',zIndex:100,overflow:'hidden',minWidth:140}}>
                      {[{icon:'📌',label:isPinned?'고정 해제':'고정',action:isPinned?'unpin':'pin'},{icon:'🔇',label:'음소거',action:'mute'},{icon:'📩',label:'안읽음',action:'unread'},{icon:'🗑️',label:'삭제',action:'delete',color:'#c62828'}].map(item => (
                        <button key={item.action} onClick={() => handleAction(item.action, conv)}
                          style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 14px',border:'none',background:'none',textAlign:'left',cursor:'pointer',fontSize:13,color:item.color||'#333'}}>
                          <span>{item.icon}</span><span>{item.label}</span>
                        </button>
                      ))}
                      <button onClick={() => setLongPressConv(null)} style={{width:'100%',padding:'10px 14px',border:'none',background:'#f5f5f5',textAlign:'center',cursor:'pointer',fontSize:12,color:'#999'}}>닫기</button>
                    </div>
                  )}
                </div>
              );
            })}
            {hasMoreConvs && (
              <div style={{textAlign:'center',padding:16}}>
                <button onClick={() => loadConversations(false)} disabled={loadingMore}
                  style={{background:'#f5f5f5',border:'1px solid #e0e0e0',borderRadius:20,padding:'10px 24px',fontSize:13,color:'#666',cursor:'pointer'}}>
                  {loadingMore ? '로딩중...' : '더 많은 대화 불러오기'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav active="chat" />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh'}}>로딩중...</div>}>
      <ChatContent />
    </Suspense>
  );
}
