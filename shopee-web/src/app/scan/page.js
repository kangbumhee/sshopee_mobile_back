'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChange } from '../../lib/firebase';
import { setupWakeLock } from '../../lib/wakeLock';
import BottomNav from '../../components/BottomNav';

export default function ScanPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [focusStatus, setFocusStatus] = useState('');
  const html5QrCodeRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      if (!u) router.push('/login');
    });
    return () => { stopScanner(); unsub(); };
  }, [router]);

  useEffect(() => {
    if (user) setupWakeLock();
  }, [user]);

  useEffect(() => {
    if (user && !scanning) startScanner();
  }, [user]);

  const applyAdvancedConstraints = async (track) => {
    try {
      const capabilities = track.getCapabilities();
      const constraints = {};

      // 자동 초점 설정
      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        constraints.focusMode = 'continuous';
        setFocusStatus('자동초점 ON');
      } else if (capabilities.focusMode && capabilities.focusMode.includes('single-shot')) {
        constraints.focusMode = 'single-shot';
        setFocusStatus('단일초점');
      }

      // 줌 범위 확인 및 기본 2x 줌
      if (capabilities.zoom) {
        const max = capabilities.zoom.max || 1;
        const min = capabilities.zoom.min || 1;
        setMaxZoom(Math.min(max, 10));
        const defaultZoom = Math.min(2, max);
        constraints.zoom = defaultZoom;
        setZoomLevel(defaultZoom);
      }

      // 해상도 최적화 (바코드용 FHD)
      if (capabilities.width && capabilities.width.max >= 1920) {
        constraints.width = { ideal: 1920 };
        constraints.height = { ideal: 1080 };
      }

      // 플래시(토치) 확인
      if (capabilities.torch) {
        setHasFlash(true);
      }

      if (Object.keys(constraints).length > 0) {
        await track.applyConstraints({ advanced: [constraints] });
      }
    } catch (e) {
      console.warn('카메라 고급 설정 실패:', e);
    }
  };

  const startScanner = async () => {
    try {
      setCameraError('');
      const { Html5Qrcode } = await import('html5-qrcode');

      if (html5QrCodeRef.current) {
        try { await html5QrCodeRef.current.stop(); } catch(e) {}
        try { html5QrCodeRef.current.clear(); } catch(e) {}
      }

      html5QrCodeRef.current = new Html5Qrcode('qr-reader');
      setScanning(true);

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 250, height: 80 },
          aspectRatio: 1.777,
          disableFlip: false,
          formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        },
        (decodedText) => {
          const cleaned = decodedText.trim();
          if (cleaned.length !== 15) {
            console.log('15자리 아님, 재스캔:', cleaned.length, cleaned);
            return;
          }
          if (navigator.vibrate) navigator.vibrate(200);
          stopScanner();
          router.push(`/scan-result?tracking=${encodeURIComponent(cleaned)}`);
        },
        () => {}
      );

      // 카메라 시작 후 비디오 트랙 가져와서 고급 설정 적용
      setTimeout(async () => {
        try {
          const videoElement = document.querySelector('#qr-reader video');
          if (videoElement && videoElement.srcObject) {
            const track = videoElement.srcObject.getVideoTracks()[0];
            if (track) {
              trackRef.current = track;
              await applyAdvancedConstraints(track);
            }
          }
        } catch (e) {
          console.warn('트랙 접근 실패:', e);
        }
      }, 1000);

    } catch (e) {
      console.error('스캐너 시작 실패:', e);
      setCameraError('카메라를 열 수 없습니다: ' + e.message);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try { await html5QrCodeRef.current.stop(); } catch (e) {}
      try { html5QrCodeRef.current.clear(); } catch (e) {}
      html5QrCodeRef.current = null;
    }
    trackRef.current = null;
    setScanning(false);
    setFocusStatus('');
    setHasFlash(false);
    setFlashOn(false);
  };

  const handleZoomChange = async (newZoom) => {
    setZoomLevel(newZoom);
    if (trackRef.current) {
      try {
        await trackRef.current.applyConstraints({ advanced: [{ zoom: newZoom }] });
      } catch (e) {}
    }
  };

  const toggleFlash = async () => {
    if (trackRef.current) {
      try {
        const newState = !flashOn;
        await trackRef.current.applyConstraints({ advanced: [{ torch: newState }] });
        setFlashOn(newState);
      } catch (e) {}
    }
  };

  const handleManualFocus = async () => {
    if (trackRef.current) {
      try {
        // 단일 초점으로 변경 후 다시 연속으로 (재초점 트리거)
        await trackRef.current.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
        setTimeout(async () => {
          try {
            await trackRef.current.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
            setFocusStatus('초점 갱신됨');
            setTimeout(() => setFocusStatus('자동초점 ON'), 1500);
          } catch (e) {}
        }, 500);
      } catch (e) {}
    }
  };

  const handleManualSearch = () => {
    if (manualInput.trim()) {
      stopScanner();
      router.push(`/scan-result?tracking=${encodeURIComponent(manualInput.trim())}`);
    }
  };

  if (!user) return null;

  return (
    <div style={{fontFamily:'-apple-system,sans-serif'}}>
      <div className="header">
        <button onClick={() => { stopScanner(); router.push('/'); }} style={{background:'none',border:'none',color:'white',fontSize:'18px',cursor:'pointer'}}>
          ← 홈으로
        </button>
        <span>바코드 스캔</span>
        <div style={{width:'40px'}}></div>
      </div>

      <div className="scan-container" style={{padding:'16px'}}>
        {/* 카메라 뷰 */}
        <div style={{position:'relative'}}>
          <div id="qr-reader" style={{
            width:'100%',
            maxWidth:'400px',
            margin:'0 auto 8px',
            borderRadius:'12px',
            overflow:'hidden',
            background:'#000',
            minHeight: scanning ? '200px' : '0px',
            maxHeight: scanning ? '35vh' : '0px',
          }}></div>

          {/* 초점 상태 표시 */}
          {scanning && focusStatus && (
            <div style={{
              position:'absolute',top:12,left:'50%',transform:'translateX(-50%)',
              background:'rgba(0,0,0,0.6)',color:'#4caf50',padding:'4px 12px',
              borderRadius:12,fontSize:11,fontWeight:'bold'
            }}>
              🎯 {focusStatus}
            </div>
          )}
        </div>

        {/* 줌 + 플래시 + 초점 컨트롤 */}
        {scanning && (maxZoom > 1 || hasFlash || focusStatus) && (
          <div style={{maxWidth:400,margin:'0 auto 12px',padding:'0 8px'}}>
            {/* 줌 슬라이더 */}
            {maxZoom > 1 && (
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{fontSize:12,color:'#666',minWidth:28}}>1x</span>
              <input
                type="range"
                min={1}
                max={maxZoom}
                step={0.1}
                value={zoomLevel}
                onChange={e => handleZoomChange(parseFloat(e.target.value))}
                style={{flex:1,accentColor:'#ee4d2d'}}
              />
              <span style={{fontSize:12,color:'#666',minWidth:36}}>{zoomLevel.toFixed(1)}x</span>
            </div>
            )}

            {/* 줌 프리셋 + 플래시 + 초점 버튼 */}
            <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
              {maxZoom > 1 && [1, 2, 3, 5].filter(z => z <= maxZoom).map(z => (
                <button key={z} onClick={() => handleZoomChange(z)}
                  style={{
                    padding:'6px 14px',borderRadius:16,fontSize:12,cursor:'pointer',
                    border: zoomLevel === z ? '2px solid #ee4d2d' : '1px solid #ddd',
                    background: zoomLevel === z ? '#fff0ed' : 'white',
                    color: zoomLevel === z ? '#ee4d2d' : '#666',
                    fontWeight: zoomLevel === z ? 'bold' : 'normal',
                  }}>
                  {z}x
                </button>
              ))}
              <button onClick={handleManualFocus}
                style={{padding:'6px 14px',borderRadius:16,fontSize:12,cursor:'pointer',border:'1px solid #ddd',background:'white',color:'#666'}}>
                🎯 초점
              </button>
              {hasFlash && (
                <button onClick={toggleFlash}
                  style={{
                    padding:'6px 14px',borderRadius:16,fontSize:12,cursor:'pointer',
                    border: flashOn ? '2px solid #ff9800' : '1px solid #ddd',
                    background: flashOn ? '#fff8e1' : 'white',
                    color: flashOn ? '#ff9800' : '#666',
                  }}>
                  {flashOn ? '🔦 ON' : '🔦 OFF'}
                </button>
              )}
            </div>
          </div>
        )}

        {cameraError && (
          <div style={{color:'red',textAlign:'center',fontSize:'13px',marginBottom:'12px'}}>
            {cameraError}
          </div>
        )}

        {!scanning ? (
          <button className="btn" onClick={startScanner} style={{marginBottom:'16px',width:'100%',maxWidth:400,display:'block',margin:'0 auto 16px'}}>
            📷 카메라 스캔 시작
          </button>
        ) : (
          <button className="btn btn-outline" onClick={stopScanner} style={{marginBottom:'16px',width:'100%',maxWidth:400,display:'block',margin:'0 auto 16px'}}>
            ⏹ 스캔 중지
          </button>
        )}

        <div style={{textAlign:'center',color:'#999',margin:'16px 0',fontSize:'13px'}}>
          — 또는 직접 입력 —
        </div>

        <div style={{display:'flex',gap:'8px',maxWidth:400,margin:'0 auto'}}>
          <input
            className="input"
            placeholder="트래킹 번호 또는 주문번호 입력..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
          />
          <button className="btn" style={{width:'80px',flexShrink:0}} onClick={handleManualSearch}>
            검색
          </button>
        </div>
      </div>

      <BottomNav active="scan" />
    </div>
  );
}
