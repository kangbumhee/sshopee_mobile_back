'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthChange, functions } from '../../../lib/firebase';
import { httpsCallable } from 'firebase/functions';

function AuthSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopId = searchParams.get('shop_id');
  const shopName = searchParams.get('shop_name');
  const region = searchParams.get('region');
  const pending = searchParams.get('pending');
  const [status, setStatus] = useState(pending === 'true' ? 'claiming' : 'done');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      if (!u) router.push('/login');
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (user && pending === 'true' && shopId) {
      claimShop();
    }
  }, [user, pending, shopId]);

  const claimShop = async () => {
    try {
      const claimFn = httpsCallable(functions, 'claimPendingShop');
      await claimFn({ shopId });
      setStatus('done');
    } catch (e) {
      setStatus('error');
      console.error(e);
    }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'-apple-system,sans-serif',background:'#f5f5f5'}}>
      <div style={{background:'white',borderRadius:16,padding:32,maxWidth:400,width:'90%',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.1)'}}>
        {status === 'claiming' ? (
          <>
            <div style={{fontSize:48,marginBottom:16}}>⏳</div>
            <h2 style={{fontSize:18,marginBottom:8}}>샵 연결 중...</h2>
            <p style={{color:'#666',fontSize:14}}>잠시만 기다려주세요</p>
          </>
        ) : status === 'done' ? (
          <>
            <div style={{fontSize:48,marginBottom:16}}>✅</div>
            <h2 style={{fontSize:18,marginBottom:8}}>샵 연결 완료!</h2>
            <div style={{background:'#f9f9f9',borderRadius:8,padding:12,marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:'bold'}}>{shopName ? decodeURIComponent(shopName) : shopId}</div>
              {region && <div style={{fontSize:13,color:'#888',marginTop:4}}>리전: {decodeURIComponent(region).toUpperCase()}</div>}
            </div>
            <button onClick={() => router.push('/')}
              style={{width:'100%',padding:12,background:'#ee4d2d',color:'white',border:'none',borderRadius:8,fontSize:16,fontWeight:'bold',cursor:'pointer'}}>
              홈으로 이동
            </button>
          </>
        ) : (
          <>
            <div style={{fontSize:48,marginBottom:16}}>❌</div>
            <h2 style={{fontSize:18,marginBottom:8}}>연결 실패</h2>
            <p style={{color:'#c62828',fontSize:14}}>다시 시도해주세요</p>
            <button onClick={() => router.push('/settings')}
              style={{width:'100%',padding:12,marginTop:16,background:'#ee4d2d',color:'white',border:'none',borderRadius:8,fontSize:16,cursor:'pointer'}}>
              설정으로 이동
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={<div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh'}}>로딩중...</div>}>
      <AuthSuccessContent />
    </Suspense>
  );
}
