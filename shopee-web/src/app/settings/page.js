'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChange, logout, functions, app, getConnectedShops } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import QRCode from 'qrcode';
import BottomNav from '../../components/BottomNav';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [autoScan, setAutoScan] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [qrModal, setQrModal] = useState(null);
  const qrUnsubRef = useRef(null);
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);

  const REGION_FLAGS = { SG:'🇸🇬', MY:'🇲🇾', PH:'🇵🇭', TH:'🇹🇭', TW:'🇹🇼', VN:'🇻🇳', BR:'🇧🇷', MX:'🇲🇽', ID:'🇮🇩' };

  useEffect(() => {
    setShowCompleted(localStorage.getItem('shopee_show_completed') === 'true');
    setShowCancelled(localStorage.getItem('shopee_show_cancelled') === 'true');
  }, []);

  useEffect(() => {
    setSoundEnabled(localStorage.getItem('shopee_sound') !== 'false');
  }, []);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      if (!u) router.push('/login');
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem('shopee_auto_scan');
    setAutoScan(saved === 'true');
  }, []);

  useEffect(() => {
    if (user) {
      setShopsLoading(true);
      getConnectedShops()
        .then(res => {
          setShops(res.data?.shops || []);
        })
        .catch(() => setShops([]))
        .finally(() => setShopsLoading(false));
    }
  }, [user]);

  const toggleAutoScan = () => {
    const newValue = !autoScan;
    setAutoScan(newValue);
    localStorage.setItem('shopee_auto_scan', String(newValue));
  };

  const toggleCompleted = () => {
    const next = !showCompleted;
    setShowCompleted(next);
    localStorage.setItem('shopee_show_completed', String(next));
  };

  const toggleCancelled = () => {
    const next = !showCancelled;
    setShowCancelled(next);
    localStorage.setItem('shopee_show_cancelled', String(next));
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('shopee_sound', String(next));
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const closeQrModal = () => {
    if (qrUnsubRef.current) {
      qrUnsubRef.current();
      qrUnsubRef.current = null;
    }
    setQrModal(null);
  };

  const connectShop = async () => {
    var confirmed = confirm('Shopee \uC0F5 \uC5F0\uACB0 \uC548\uB0B4\n\n1. \uD655\uC778\uC744 \uB204\uB974\uBA74 \uAD00\uB9AC\uC790\uC5D0\uAC8C \uC5F0\uACB0 \uC694\uCCAD\uC774 \uC804\uC1A1\uB429\uB2C8\uB2E4\n2. \uAD00\uB9AC\uC790\uAC00 \uC694\uCCAD\uC744 \uD655\uC778 \uD6C4 \uCC98\uB9AC\uD569\uB2C8\uB2E4\n3. \uCC98\uB9AC \uC644\uB8CC \uC2DC \uC774\uBA54\uC77C\uB85C \uC548\uB0B4\uB97C \uBC1B\uC2B5\uB2C8\uB2E4\n4. \uC774\uBA54\uC77C \uC548\uB0B4\uC5D0 \uB530\uB77C \uC644\uB8CC\uD574\uC8FC\uC138\uC694\n\n\uC694\uCCAD\uC744 \uBCF4\uB0B4\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?');
    if (!confirmed) return;
    const msg = prompt('Enter shop name or message (optional):');
    if (msg === null) return;
    try {
      const fn = httpsCallable(functions, 'createShopRequest');
      const result = await fn({ message: msg, displayName: user.displayName || user.email || '' });
      if (result.data?.success) {
        alert('\uC694\uCCAD\uC774 \uC804\uC1A1\uB418\uC5C8\uC2B5\uB2C8\uB2E4!\n\n\uAD00\uB9AC\uC790\uAC00 \uD655\uC778 \uD6C4 \uCC98\uB9AC\uD560 \uC608\uC815\uC785\uB2C8\uB2E4.\n\uCC98\uB9AC \uC644\uB8CC \uC2DC \uC774\uBA54\uC77C\uB85C \uC548\uB0B4\uB4DC\uB9BD\uB2C8\uB2E4.');
      }
    } catch (e) {
      alert('Request failed: ' + (e.message || 'Unknown error'));
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="header">
        <span>⚙️ 설정</span>
      </div>

      <div style={{padding:'12px'}}>

        {/* Admin button */}
        {user && user.email === 'kbhjjan@gmail.com' && (
          <div style={{marginBottom:'16px'}}>
            <button onClick={()=>router.push('/admin')}
              style={{width:'100%',padding:12,background:'#333',color:'white',border:'none',borderRadius:8,fontSize:14,cursor:'pointer'}}>
              Admin Page
            </button>
          </div>
        )}        {/* 연결된 샵 */}
        <div style={{marginBottom:'16px',background:'white',borderRadius:12,padding:'16px',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
          <h3 style={{fontSize:15,marginBottom:12}}>🏪 연결된 샵</h3>
          {shopsLoading ? (
            <div style={{fontSize:13,color:'#999'}}>로딩중...</div>
          ) : shops.length === 0 ? (
            <div style={{fontSize:13,color:'#888'}}>연결된 샵이 없습니다. 아래에서 연결해주세요.</div>
          ) : (
            <div style={{maxHeight:220,overflowY:'auto'}}>
              {shops.map(s => (
                <div key={s.shop_id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #f0f0f0',fontSize:13}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span>{REGION_FLAGS[s.region] || s.region || '🌐'}</span>
                    <span>{s.shop_name || s.shop_id}</span>
                    {s.memo && <span style={{fontSize:11,color:'#999'}}>({s.memo})</span>}
                  </div>
                  <div style={{width:8,height:8,borderRadius:'50%',background:s.token_valid?'#4caf50':'#f44336',flexShrink:0}} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shopee 샵 연결 */}
        <div style={{marginBottom:'16px',background:'white',borderRadius:12,padding:'16px',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
          <h3 style={{fontSize:15,marginBottom:12}}>🔗 Shopee 샵 연결</h3>
          <p style={{fontSize:12,color:'#888',marginBottom:12}}>Shopee 셀러 계정을 연결하면 주문/채팅/재고 관리가 가능합니다.</p>
          <button onClick={connectShop}
            style={{width:'100%',padding:12,background:'#ee4d2d',color:'white',border:'none',borderRadius:8,fontSize:15,fontWeight:'bold',cursor:'pointer'}}>
            🛍️ Shopee 샵 연결하기
          </button>
        </div>

        {qrModal && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)',
              display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999,
            }}
            onClick={closeQrModal}
          >
            <div
              style={{ background: 'white', padding: 28, borderRadius: 16, textAlign: 'center', maxWidth: 340, margin: 16, width: '90%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>🔗 PC에서 샵 연결하기</h3>
              <p style={{ color: '#666', fontSize: 12, margin: '0 0 16px' }}>
                아래 방법 중 하나로 PC에서 접속하세요
              </p>

              <div style={{
                background: '#f5f5f5', borderRadius: 8, padding: '10px 12px', margin: '0 0 12px',
                fontSize: 13, wordBreak: 'break-all', color: '#333', fontFamily: 'monospace',
              }}>
                {qrModal.shortUrl || qrModal.qrUrl}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(qrModal.shortUrl || qrModal.qrUrl);
                      alert('✅ 링크가 복사되었습니다!\nPC 브라우저에 붙여넣기 하세요.');
                    } catch (err) {
                      const ta = document.createElement('textarea');
                      ta.value = qrModal.shortUrl || qrModal.qrUrl;
                      document.body.appendChild(ta);
                      ta.select();
                      document.execCommand('copy');
                      document.body.removeChild(ta);
                      alert('✅ 링크가 복사되었습니다!');
                    }
                  }}
                  style={{ padding: '12px', background: '#ee4d2d', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
                >
                  📋 링크 복사하기
                </button>

                <button
                  onClick={() => {
                    const url = qrModal.shortUrl || qrModal.qrUrl;
                    const text = `[Shopee 샵 연결]\nPC 브라우저에서 아래 링크를 열어주세요:\n${url}`;
                    if (navigator.share) {
                      navigator.share({ title: 'Shopee 샵 연결', text, url }).catch(() => {});
                    } else {
                      window.open(`https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
                    }
                  }}
                  style={{ padding: '12px', background: '#FEE500', color: '#3C1E1E', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
                >
                  💬 카카오톡 / 공유하기
                </button>

                <button
                  onClick={() => setQrModal((prev) => ({ ...prev, showQR: !prev.showQR }))}
                  style={{ padding: '10px', background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}
                >
                  {qrModal.showQR ? '▲ QR 숨기기' : '▼ QR 코드 보기 (주변 PC 있을 때)'}
                </button>
              </div>

              {qrModal.showQR && qrModal.qrDataUrl && (
                <div style={{ marginBottom: 12 }}>
                  <img src={qrModal.qrDataUrl} alt="QR" style={{ width: 180, height: 180, margin: '0 auto', display: 'block' }} />
                  <p style={{ color: '#999', fontSize: 11, marginTop: 8 }}>PC 카메라로 스캔하세요</p>
                </div>
              )}

              <p style={{ color: '#ee4d2d', fontSize: 12, margin: '4px 0 12px' }}>
                ⏳ 10분 내 인증 완료 시 자동 연결됩니다
              </p>

              <button
                onClick={closeQrModal}
                style={{ padding: '8px 28px', background: '#eee', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 계정 정보 */}
        <div className="card">
          <div style={{fontWeight:'bold',fontSize:'14px',marginBottom:'12px'}}>👤 계정 정보</div>
          <div style={{fontSize:'13px',color:'#666'}}>
            <div>이메일: {user.email}</div>
            <div>UID: {user.uid}</div>
          </div>
        </div>

        {/* 앱 설정 */}
        <div className="card">
          <div style={{fontWeight:'bold',fontSize:'14px',marginBottom:'12px'}}>📱 앱 설정</div>

          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'12px 0', borderBottom:'1px solid #f0f0f0',
          }}>
            <div>
              <div style={{fontSize:'14px',fontWeight:'500'}}>앱 시작 시 바코드 스캔</div>
              <div style={{fontSize:'12px',color:'#999'}}>앱을 열면 자동으로 스캔 화면으로 이동</div>
            </div>
            <button
              onClick={toggleAutoScan}
              style={{
                width:'52px', height:'28px', borderRadius:'14px', border:'none',
                background: autoScan ? '#ee4d2d' : '#ddd',
                position:'relative', cursor:'pointer', transition:'background 0.3s',
              }}
            >
              <div style={{
                width:'24px', height:'24px', borderRadius:'12px', background:'white',
                position:'absolute', top:'2px',
                left: autoScan ? '26px' : '2px',
                transition:'left 0.3s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
              }}></div>
            </button>
          </div>
        </div>

        {/* 주문 현황 표시 */}
        <div style={{margin:'16px',background:'white',borderRadius:12,padding:'16px',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
          <h3 style={{fontSize:15,marginBottom:12}}>📊 주문 현황 표시</h3>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #f0f0f0'}}>
            <span>완료 주문 표시</span>
            <div onClick={toggleCompleted} style={{width:50,height:28,borderRadius:14,background:showCompleted?'#4caf50':'#ddd',cursor:'pointer',position:'relative',transition:'background 0.3s'}}>
              <div style={{width:24,height:24,borderRadius:12,background:'white',position:'absolute',top:2,left:showCompleted?24:2,transition:'left 0.3s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #f0f0f0'}}>
            <span>취소/반품 주문 표시</span>
            <div onClick={toggleCancelled} style={{width:50,height:28,borderRadius:14,background:showCancelled?'#4caf50':'#ddd',cursor:'pointer',position:'relative',transition:'background 0.3s'}}>
              <div style={{width:24,height:24,borderRadius:12,background:'white',position:'absolute',top:2,left:showCancelled?24:2,transition:'left 0.3s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0'}}>
            <span>🔊 효과음</span>
            <div onClick={toggleSound} style={{width:50,height:28,borderRadius:14,background:soundEnabled?'#4caf50':'#ddd',cursor:'pointer',position:'relative',transition:'background 0.3s'}}>
              <div style={{width:24,height:24,borderRadius:12,background:'white',position:'absolute',top:2,left:soundEnabled?24:2,transition:'left 0.3s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
            </div>
          </div>
        </div>

        {/* 정보 */}
        <div className="card">
          <div style={{fontWeight:'bold',fontSize:'14px',marginBottom:'12px'}}>ℹ️ 앱 정보</div>
          <div style={{fontSize:'13px',color:'#666'}}>
            <div>버전: 1.0.0</div>
            <div>Shopee Manager - 쇼피 주문 관리</div>
          </div>
        </div>

        {/* 로그아웃 */}
        <button
          className="btn"
          onClick={handleLogout}
          style={{marginTop:'12px',background:'#666'}}
        >
          로그아웃
        </button>
      </div>

      <BottomNav active="settings" />
    </div>
  );
}
