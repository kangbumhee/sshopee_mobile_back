import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyAG5XwWRs4Q78yTbTCTu_HNpLWzsjzF71Q',
  authDomain: 'shopee-api-68797.firebaseapp.com',
  projectId: 'shopee-api-68797',
  storageBucket: 'shopee-api-68797.firebasestorage.app',
  messagingSenderId: '90781963260',
  appId: '1:90781963260:web:e8ad483f6ab3bb2a351879',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 서울 리전 사용 (asia-northeast3)
const functions = getFunctions(app, 'asia-northeast3');

// 개발 시 에뮬레이터 사용 시 아래 주석 해제
// connectFunctionsEmulator(functions, 'localhost', 5001);

export const shopeeApi = httpsCallable(functions, 'shopeeApiProxy');
export const getShops = httpsCallable(functions, 'getConnectedShops');
