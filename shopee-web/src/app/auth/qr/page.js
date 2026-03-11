'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../../lib/firebase';

const db = getFirestore(app);

function QRAuthContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setError('세션 정보가 없습니다.');
      return;
    }

    (async () => {
      try {
        const sessionRef = doc(db, 'authSessions', sessionId);
        const snap = await getDoc(sessionRef);

        if (!snap.exists()) {
          setStatus('error');
          setError('유효하지 않은 세션입니다.');
          return;
        }

        const session = snap.data();

        if (session.status === 'done') {
          setStatus('already_done');
          return;
        }

        const expiresAt = session.expiresAt;
        if (expiresAt && (expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt.seconds * 1000)) < new Date()) {
          setStatus('expired');
          return;
        }

        if (session.authUrl) {
          window.location.href = session.authUrl;
        } else {
          setStatus('error');
          setError('인증 URL이 없습니다.');
        }
      } catch (e) {
        setStatus('error');
        setError(e.message || '오류가 발생했습니다.');
      }
    })();
  }, [sessionId]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', background: '#f5f5f5' }}>
      <div style={{ background: 'white', padding: 40, borderRadius: 12, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', maxWidth: 400 }}>
        {status === 'loading' && (
          <>
            <div style={{ width: 40, height: 40, border: '4px solid #eee', borderTop: '4px solid #ee4d2d', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
            <h3>Shopee 인증 페이지로 이동 중...</h3>
          </>
        )}
        {status === 'already_done' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3>이미 연결이 완료되었습니다</h3>
            <p style={{ color: '#666' }}>모바일 앱으로 돌아가주세요.</p>
          </>
        )}
        {status === 'expired' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
            <h3>세션이 만료되었습니다</h3>
            <p style={{ color: '#666' }}>모바일 앱에서 다시 시도해주세요.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h3>오류 발생</h3>
            <p style={{ color: 'red' }}>{error}</p>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

export default function QRAuthPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f5f5' }}>로딩 중...</div>}>
      <QRAuthContent />
    </Suspense>
  );
}
