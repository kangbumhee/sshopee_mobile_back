'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

var fbApp = getApps().find(a=>a.name==='shorturl') || initializeApp({ apiKey: "AIzaSyAG5XwWRs4Q78yTbTCTu_HNpLWzsjzF71Q", authDomain: "shopee-api-68797.firebaseapp.com", projectId: "shopee-api-68797" }, 'shorturl');
var db = getFirestore(fbApp);

function ShortUrlContent() {
  var searchParams = useSearchParams();
  var [status, setStatus] = useState('loading');
  var [error, setError] = useState('');

  useEffect(function() {
    var code = searchParams.get('code');
    if (!code) {
      var pathParts = window.location.pathname.split('/');
      code = pathParts[pathParts.length - 1];
    }
    if (!code || code === 's') { setStatus('error'); setError('Invalid link'); return; }

    (async function() {
      try {
        var shortDoc = await getDoc(doc(db, 'shortUrls', code.toUpperCase()));
        if (!shortDoc.exists()) { setStatus('error'); setError('Link not found'); return; }
        var sessionId = shortDoc.data().sessionId;
        var sessionDoc = await getDoc(doc(db, 'authSessions', sessionId));
        if (!sessionDoc.exists()) { setStatus('error'); setError('Session not found'); return; }
        var session = sessionDoc.data();
        if (session.status === 'done') { setStatus('done'); return; }
        var exp = session.expiresAt;
        if (exp && (exp.toDate ? exp.toDate() : new Date(exp.seconds * 1000)) < new Date()) { setStatus('expired'); return; }

        setStatus('redirecting');
        var resp = await fetch('https://us-central1-shopee-api-68797.cloudfunctions.net/getAuthUrlForSession?sessionId=' + sessionId);
        var data = await resp.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          setStatus('error');
          setError(data.error || 'Failed to get auth URL');
        }
      } catch (e) { setStatus('error'); setError(e.message); }
    })();
  }, [searchParams]);

  var css = '@keyframes spin{to{transform:rotate(360deg)}}';
  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',fontFamily:'sans-serif',background:'#f5f5f5'}}>
      <div style={{background:'white',padding:40,borderRadius:12,textAlign:'center',boxShadow:'0 2px 12px rgba(0,0,0,0.1)',maxWidth:400}}>
        {(status==='loading'||status==='redirecting')&&(<><div style={{width:40,height:40,border:'4px solid #eee',borderTop:'4px solid #ee4d2d',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 20px'}}/><h3>{status==='redirecting'?'Shopee redirecting...':'Loading...'}</h3></>)}
        {status==='done'&&(<><div style={{fontSize:48,marginBottom:16}}>OK</div><h3>Already connected</h3><p style={{color:'#666'}}>Check your mobile app.</p></>)}
        {status==='expired'&&(<><div style={{fontSize:48,marginBottom:16}}>EXPIRED</div><h3>Link expired</h3><p style={{color:'#666'}}>Please try again.</p></>)}
        {status==='error'&&(<><div style={{fontSize:48,marginBottom:16}}>ERROR</div><h3>Error</h3><p style={{color:'red'}}>{error}</p></>)}
      </div>
      <style dangerouslySetInnerHTML={{__html:css}}/>
    </div>
  );
}

export default function ShortUrlPage() {
  return (
    <Suspense fallback={<div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:'#f5f5f5'}}>Loading...</div>}>
      <ShortUrlContent />
    </Suspense>
  );
}
