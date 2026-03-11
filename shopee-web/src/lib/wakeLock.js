let wakeLock = null;

export const requestWakeLock = async () => {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock 해제됨');
      });
      console.log('Wake Lock 활성화');
    }
  } catch (e) {
    console.error('Wake Lock 실패:', e);
  }
};

export const releaseWakeLock = async () => {
  if (wakeLock) {
    try { await wakeLock.release(); } catch (e) {}
    wakeLock = null;
  }
};

// 페이지 다시 활성화 시 자동 재요청
export const setupWakeLock = () => {
  requestWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });
};
