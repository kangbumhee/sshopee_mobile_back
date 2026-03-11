'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAG5XwWRs4Q78yTbTCTu_HNpLWzsjzF71Q",
  authDomain: "shopee-api-68797.firebaseapp.com",
  projectId: "shopee-api-68797",
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, 'us-central1');
const db = getFirestore(app);

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [cmdResult, setCmdResult] = useState(null);
  const router = useRouter();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const successMsg = params?.get('success');
  const errorMsg = params?.get('error');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const fn = httpsCallable(functions, 'getShopRequests');
          const res = await fn();
          setRequests(res.data.requests || []);
          setIsAdmin(true);
        } catch (e) {
          setIsAdmin(false);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'shopRequests'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setRequests(list);
    });
    return () => unsub();
  }, [isAdmin]);

  const handleAuth = async (requestId) => {
    try {
      const fn = httpsCallable(functions, 'getAdminAuthUrl');
      const res = await fn({ requestId });
      window.location.href = res.data.authUrl;
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  if (loading) return <div style={styles.center}><p>Loading...</p></div>;
  if (!user) return <div style={styles.center}><p>Please login first</p></div>;
  if (!isAdmin) return <div style={styles.center}><p>Admin access required</p></div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Shop Connect Admin</h1>
      
      {/* Manual Connect Form */}
      <div style={styles.manualCard}>
        <h3 style={{fontSize:16,marginBottom:8}}>Easy Shop Connect</h3>
        <p style={{fontSize:12,color:'#666',marginBottom:12}}>
          1. Copy UID from request below<br/>
          2. Open Platform Console &rarr; Authorize<br/>
          3. Paste the full callback URL below &rarr; auto connect
        </p>
        
        <input id="admin-uid" placeholder="User UID (copy from below)" style={{...styles.input,marginBottom:8,width:'100%',boxSizing:'border-box'}} />
        <textarea id="admin-url" placeholder={"Paste callback URL here\nhttps://shopee-api-68797.web.app/auth/callback?code=xxx&main_account_id=xxx"} 
          style={{...styles.input,width:'100%',boxSizing:'border-box',minHeight:70,fontFamily:'monospace',fontSize:11,marginBottom:8,resize:'vertical'}} />
        
        {cmdResult && <div style={{background:cmdResult.ok?'#e8f5e9':'#ffebee',color:cmdResult.ok?'#2e7d32':'#c62828',padding:12,borderRadius:8,marginBottom:8,fontSize:13,whiteSpace:'pre-wrap'}}>{cmdResult.msg}</div>}
        
        <button onClick={async()=>{
          var uid=document.getElementById('admin-uid').value.trim();
          var urlStr=document.getElementById('admin-url').value.trim();
          if(!uid||!urlStr){setCmdResult({ok:false,msg:'UID and URL required'});return;}
          try{
            var url=new URL(urlStr);
            var code=url.searchParams.get('code');
            var shopId=url.searchParams.get('shop_id');
            var mainId=url.searchParams.get('main_account_id');
            if(!code){setCmdResult({ok:false,msg:'code not found in URL'});return;}
            if(!shopId&&!mainId){setCmdResult({ok:false,msg:'shop_id or main_account_id not found'});return;}
            var id=mainId||shopId;
            var type=mainId?'main':'shop';
            var cmd='cd "c:\\Projects\\���� ����Ͼ�\\functions" && node manualConnect.js '+uid+' '+code+' '+id+(mainId?' main':'');
            await navigator.clipboard.writeText(cmd);
            setCmdResult({ok:true,msg:'Command copied to clipboard! Paste in PowerShell:\n\n'+cmd});
          }catch(e){setCmdResult({ok:false,msg:'Error: '+e.message});}
        }} style={{...styles.btn,width:'100%',boxSizing:'border-box',background:'#1976d2'}}>
          Generate & Copy Command
        </button>
      </div>
      {successMsg && <div style={styles.success}>Connected: {successMsg}</div>}
      {errorMsg && <div style={styles.error}>Error: {errorMsg}</div>}
      <div style={styles.list}>
        {requests.length === 0 && <p style={styles.empty}>No pending requests</p>}
        {requests.map(r => (
          <div key={r.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={{...styles.badge, background: r.status === 'pending' ? '#ff9800' : r.status === 'done' ? '#4caf50' : '#f44336'}}>
                {r.status}
              </span>
              <span style={styles.date}>
                {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString('ko-KR') : ''}
              </span>
            </div>
            <p style={styles.info}><b>User:</b> {r.displayName || r.email || r.uid}</p>
            <p style={styles.info}><b>Email:</b> {r.email}</p>
            <p style={styles.info}><b>UID:</b> {r.uid}</p>
            {r.message && <p style={styles.info}><b>Message:</b> {r.message}</p>}
            {r.shopName && <p style={styles.info}><b>Shop:</b> {r.shopName} ({r.region})</p>}
            {r.error && <p style={{...styles.info, color: '#f44336'}}><b>Error:</b> {r.error}</p>}
            {r.status === 'pending' && (
              <button onClick={() => handleAuth(r.id)} style={styles.btn}>
                Authorize Shop
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: 800, margin: '0 auto', padding: 20 },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  success: { background: '#e8f5e9', color: '#2e7d32', padding: 12, borderRadius: 8, marginBottom: 16 },
  error: { background: '#ffebee', color: '#c62828', padding: 12, borderRadius: 8, marginBottom: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  empty: { color: '#888', textAlign: 'center', padding: 40 },
  card: { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: 16 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  date: { fontSize: 12, color: '#888' },
  info: { fontSize: 14, margin: '4px 0', color: '#333' },
  input: { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 },
  manualCard: { background: '#fff', border: '2px solid #1976d2', borderRadius: 12, padding: 16, marginBottom: 20 },
  btn: { marginTop: 12, padding: '10px 24px', background: '#ee4d2d', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 'bold', cursor: 'pointer' },
};
