'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChange, getConnectedShops, shopeeApiProxy } from '../../lib/firebase';
import BottomNav from '../../components/BottomNav';

const REGION_FLAGS = {
  SG: '🇸🇬', MY: '🇲🇾', PH: '🇵🇭', TH: '🇹🇭', TW: '🇹🇼',
  VN: '🇻🇳', BR: '🇧🇷', MX: '🇲🇽', ID: '🇮🇩',
  sg: '🇸🇬', my: '🇲🇾', ph: '🇵🇭', th: '🇹🇭', tw: '🇹🇼',
  vn: '🇻🇳', br: '🇧🇷', mx: '🇲🇽', id: '🇮🇩',
};

export default function StockPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState('');
  const [itemId, setItemId] = useState('');
  const [modelId, setModelId] = useState('');
  const [newStock, setNewStock] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      if (!u) router.push('/login');
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (user) loadShops();
  }, [user]);

  const loadShops = async () => {
    try {
      const res = await getConnectedShops();
      const shopList = res.data?.shops || res.data?.result?.shops || [];
      setShops(shopList);
      if (shopList.length > 0) {
        setSelectedShop(shopList[0].shop_id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedShop || !itemId || !newStock) {
      setResult({ success: false, message: '모든 필드를 입력하세요' });
      return;
    }

    try {
      setLoading(true);
      const stockData = {
        item_id: parseInt(itemId),
        stock_list: [{
          model_id: modelId ? parseInt(modelId) : 0,
          normal_stock: parseInt(newStock),
        }]
      };

      const res = await shopeeApiProxy({
        action: 'updateStock',
        shopId: selectedShop,
        params: { stockData }
      });

      if (res.data?.error) {
        setResult({ success: false, message: res.data.message || res.data.error });
      } else {
        setResult({ success: true, message: '재고가 업데이트되었습니다!' });
      }
    } catch (e) {
      setResult({ success: false, message: '실패: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="header">
        <span>📦 재고 관리</span>
      </div>

      <div style={{padding:'12px',display:'flex',flexDirection:'column',gap:'12px'}}>
        <div>
          <label style={{fontSize:'13px',color:'#666',marginBottom:'4px',display:'block'}}>샵 선택</label>
          <select className="select" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
            {shops.map((s, i) => (
              <option key={i} value={s.shop_id}>
                {REGION_FLAGS[s.region] || '🏪'} {s.shop_name || s.memo || s.shop_id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{fontSize:'13px',color:'#666',marginBottom:'4px',display:'block'}}>Item ID</label>
          <input className="input" placeholder="상품 ID" value={itemId} onChange={(e) => setItemId(e.target.value)} />
        </div>

        <div>
          <label style={{fontSize:'13px',color:'#666',marginBottom:'4px',display:'block'}}>Model ID (옵션)</label>
          <input className="input" placeholder="모델 ID (없으면 비워두기)" value={modelId} onChange={(e) => setModelId(e.target.value)} />
        </div>

        <div>
          <label style={{fontSize:'13px',color:'#666',marginBottom:'4px',display:'block'}}>변경할 재고</label>
          <input className="input" type="number" placeholder="새 재고 수량" value={newStock} onChange={(e) => setNewStock(e.target.value)} />
        </div>

        <button className="btn" onClick={handleUpdateStock} disabled={loading}>
          {loading ? '업데이트 중...' : '재고 업데이트'}
        </button>

        {result && (
          <div className="card" style={{borderLeft: `4px solid ${result.success ? '#4caf50' : '#f44336'}`}}>
            <div style={{color: result.success ? '#4caf50' : '#f44336', fontWeight:'bold'}}>
              {result.success ? '✅ 성공' : '❌ 실패'}
            </div>
            <div style={{fontSize:'13px',marginTop:'4px'}}>{result.message}</div>
          </div>
        )}
      </div>

      <BottomNav active="stock" />
    </div>
  );
}
