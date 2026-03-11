'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { auth, functions } from '../../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Shopee 샵 연결 처리 중...');
  const processedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const shop_id = searchParams.get('shop_id');
    const state = searchParams.get('state');

    if (!code || !shop_id) {
      setStatus('error');
      setMessage('인증 정보가 누락되었습니다.');
      return;
    }

    const processAuth = async (user) => {
      if (processedRef.current) return;
      processedRef.current = true;

      try {
        const process = httpsCallable(functions, 'processShopeeAuth');
        const result = await process({ code, shop_id: Number(shop_id), state });
        const data = result.data;

        if (data.success) {
          setStatus('success');
          setMessage(`✅ ${data.shop_name || '샵'} (${data.region || ''}) 연결 성공!\n모바일 앱으로 돌아가주세요.`);
          if (user) {
            setTimeout(() => router.push('/'), 2000);
          }
        } else {
          setStatus('error');
          setMessage(data.error || '연결 실패');
        }
      } catch (e) {
        setStatus('error');
        setMessage('처리 중 오류: ' + (e.message || '알 수 없는 오류'));
      }
    };

    let unsub = null;
    unsub = onAuthStateChanged(auth, (user) => {
      processAuth(user);
      if (unsub) unsub();
    });

    const t = setTimeout(() => {
      if (unsub) unsub();
      if (!processedRef.current) processAuth(null);
    }, 3000);
    return () => {
      clearTimeout(t);
      if (unsub) unsub();
    };
  }, [searchParams, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 400, width: '90%', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
        {status === 'processing' && (
          <>
            <div style={{ width: 40, height: 40, border: '4px solid #eee', borderTop: '4px solid #ee4d2d', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{message}</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 18, marginBottom: 8, color: '#2e7d32', whiteSpace: 'pre-line' }}>{message}</h2>
            <p style={{ color: '#888', fontSize: 13, marginTop: 12 }}>이 창을 닫아도 됩니다.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontSize: 18, marginBottom: 8, color: '#c62828' }}>연결 실패</h2>
            <p style={{ color: '#888', fontSize: 14 }}>{message}</p>
            <button onClick={() => router.push('/settings')} style={{ marginTop: 16, padding: '10px 24px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
              설정으로 돌아가기
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
