import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from './firebase';

const db = getFirestore(app);

export async function getShopGroups(uid) {
  const ref = doc(db, 'users', uid, 'settings', 'shopGroups');
  const snap = await ref ? await getDoc(ref) : null;
  if (snap && snap.exists()) {
    return snap.data();
  }
  return { groups: [], selectedGroupId: null };
}

export async function saveShopGroups(uid, groups, selectedGroupId) {
  const ref = doc(db, 'users', uid, 'settings', 'shopGroups');
  await setDoc(ref, { groups, selectedGroupId, updatedAt: new Date() }, { merge: true });
}

export async function saveSelectedGroup(uid, selectedGroupId) {
  const ref = doc(db, 'users', uid, 'settings', 'shopGroups');
  await setDoc(ref, { selectedGroupId, updatedAt: new Date() }, { merge: true });
}
