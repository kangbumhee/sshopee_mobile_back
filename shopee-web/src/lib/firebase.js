import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyAG5XwWRs4Q78yTbTCTu_HNpLWzsjzF71Q",
  authDomain: "shopee-api-68797.firebaseapp.com",
  projectId: "shopee-api-68797",
  storageBucket: "shopee-api-68797.firebasestorage.app",
  messagingSenderId: "90781963260",
  appId: "1:90781963260:web:e8ad483f6ab3bb2a351879"
};

const app = initializeApp(firebaseConfig);
export { app };
export const auth = getAuth(app);
export const functions = getFunctions(app, 'us-central1');

const provider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, provider);
export const logout = () => {
  ['shopee_shops', 'shopee_auto_scan', 'shopee_show_completed', 'shopee_show_cancelled', 'shopee_chat_filter'].forEach(k => localStorage.removeItem(k));
  return signOut(auth);
};
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);
export const loginWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);

// Cloud Functions (raw)
const _shopeeApiProxy = httpsCallable(functions, 'shopeeApiProxy');
const _getConnectedShops = httpsCallable(functions, 'getConnectedShops');

// Firebase callable이 { result: {...} }로 감싸서 오는 경우 data를 result로 치환
function unwrap(response) {
  const d = response?.data;
  if (d && d.result && typeof d.result === 'object' && !d.orders && !d.shops && !d.counts && !d.shopCounts) {
    return { data: d.result };
  }
  return response;
}

export const shopeeApiProxy = async (params) => {
  const res = await _shopeeApiProxy(params);
  return unwrap(res);
};

export const getConnectedShops = async (params) => {
  const res = await _getConnectedShops(params || {});
  return unwrap(res);
};
