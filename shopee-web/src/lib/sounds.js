// 효과음 — public/sounds 폴더의 mp3 사용

const isSoundEnabled = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('shopee_sound') !== 'false';
};

const playFile = (path) => {
  if (!isSoundEnabled()) return;
  try {
    const audio = new Audio(path);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch (e) {}
};

// 코인 효과음 (스캔 성공)
export const playCoinSound = () => playFile('/sounds/coin.mp3');

// 실패/취소 효과음 (취소 주문 발견)
export const playFailSound = () => playFile('/sounds/fail.mp3');

// 파워업 효과음 (새로고침 완료)
export const playPowerUpSound = () => playFile('/sounds/powerup.mp3');

// 1UP/알림 효과음 (새 메시지)
export const play1UpSound = () => playFile('/sounds/notification.mp3');

// BGM 인트로 (로그인 시)
export const playBGMIntro = () => playFile('/sounds/bgm.mp3');
