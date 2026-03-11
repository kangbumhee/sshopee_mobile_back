'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithGoogle, loginWithEmail, onAuthChange } from '../../lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const isInApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line|SamsungBrowser\/(?![\d]+)/i.test(ua)
      || (ua.includes('wv') && ua.includes('Android'));
    if (isInApp) {
      const currentUrl = window.location.href;
      if (/android/i.test(ua)) {
        window.location.href = 'intent://' + currentUrl.replace(/https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
      } else {
        setError('Safari 또는 Chrome 브라우저에서 직접 열어주세요: ' + currentUrl);
      }
      return;
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      if (user) router.push('/');
    });
    return () => unsub();
  }, [router]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await loginWithGoogle();
      router.push('/');
    } catch (e) {
      setError('로그인 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return; }
    try {
      setEmailLoading(true);
      setError('');
      await loginWithEmail(email, password);
      router.push('/');
    } catch (e) {
      setError('로그인 실패: ' + e.message);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-logo">🛒</div>
      <div className="login-title">Shopee Manager</div>
      <p style={{color:'#666',textAlign:'center'}}>쇼피 주문 관리 모바일 앱</p>

      <div style={{width:'100%',maxWidth:'320px',marginBottom:'16px'}}>
        <input type="email" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',padding:'12px',marginBottom:'8px',borderRadius:'8px',border:'1px solid #ddd',fontSize:'15px',boxSizing:'border-box'}} />
        <input type="password" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleEmailLogin()}} style={{width:'100%',padding:'12px',marginBottom:'12px',borderRadius:'8px',border:'1px solid #ddd',fontSize:'15px',boxSizing:'border-box'}} />
        <button onClick={handleEmailLogin} disabled={emailLoading} style={{width:'100%',padding:'14px',borderRadius:'10px',border:'none',background:'#6C63FF',color:'white',fontSize:'16px',fontWeight:'bold',cursor:'pointer'}}>{emailLoading ? '로그인 중...' : '이메일로 로그인'}</button>
      </div>

      <div style={{color:'#999',marginBottom:'16px',fontSize:'14px'}}>또는</div>

      <button className="google-btn" onClick={handleGoogleLogin} disabled={loading}>
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {loading ? '로그인 중...' : 'Google로 로그인'}
      </button>

      {error && <p style={{color:'red',fontSize:'13px'}}>{error}</p>}
    </div>
  );
}
