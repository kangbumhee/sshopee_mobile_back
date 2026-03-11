import {
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../config/firebase';

/**
 * Google 로그인 (Expo: Web 또는 expo-auth-session 사용)
 * 웹: Google 팝업/리다이렉트
 * 네이티브: expo-auth-session으로 ID 토큰 받아서 signInWithCredential
 */
export function getCurrentUser() {
  return auth.currentUser;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signOut() {
  await firebaseSignOut(auth);
}

/**
 * ID 토큰으로 로그인 (네이티브 Google 로그인 연동 시)
 * @param {string} idToken - Google ID token
 */
export async function signInWithGoogleIdToken(idToken) {
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  return userCredential.user;
}
