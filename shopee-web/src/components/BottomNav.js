'use client';

import { useRouter } from 'next/navigation';

export default function BottomNav({ active }) {
  const router = useRouter();

  const items = [
    { key: 'home', icon: '🏠', label: '홈', path: '/' },
    { key: 'scan', icon: '📷', label: '스캔', path: '/scan' },
    { key: 'orders', icon: '📦', label: '주문', path: '/orders' },
    { key: 'chat', icon: '💬', label: '채팅', path: '/chat' },
    { key: 'settings', icon: '⚙️', label: '설정', path: '/settings' },
  ];

  return (
    <div className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.key}
          className={`nav-item ${active === item.key ? 'active' : ''}`}
          onClick={() => router.push(item.path)}
        >
          <span className="icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
