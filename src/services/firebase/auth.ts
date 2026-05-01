import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  query,
  collection,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, db } from './config';
import { AppUser, Family, NotificationPrefs } from '../../types';

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  medications: true,
  vaccines: true,
  treatments: true,
  appointments: true,
  quietStart: '22:00',
  quietEnd: '08:00',
};

/** Generate a random 6-character alphanumeric invite code */
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/** Register a new user and create their own Family */
export async function registerAndCreateFamily(
  email: string,
  password: string,
  displayName: string,
  familyName: string
): Promise<AppUser> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const { uid } = credential.user;

  await updateProfile(credential.user, { displayName });

  const familyId = doc(collection(db, 'families')).id;
  const inviteCode = generateInviteCode();

  const family: Omit<Family, 'id'> = {
    name: familyName,
    ownerUid: uid,
    memberUids: [uid],
    inviteCode,
    createdAt: serverTimestamp() as any,
  };
  await setDoc(doc(db, 'families', familyId), family);

  const user: Omit<AppUser, 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any } = {
    uid,
    email,
    displayName,
    familyId,
    role: 'owner',
    fcmTokens: [],
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'families', familyId, 'members', uid), user);
  await setDoc(doc(db, 'users', uid), { familyId });

  return { ...user, createdAt: new Date() as any, updatedAt: new Date() as any };
}

/** Register a new user and join an existing Family via invite code.
 *  Auth account is created first so the invite-code query runs authenticated
 *  (Firestore rules require authentication to query families).
 *  If joining fails the auth account is cleaned up automatically. */
export async function registerAndJoinFamily(
  email: string,
  password: string,
  displayName: string,
  inviteCode: string
): Promise<AppUser> {
  // 1. Create auth account first so subsequent Firestore queries are authenticated
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const { uid } = credential.user;
  await updateProfile(credential.user, { displayName });

  try {
    // 2. Find family by invite code (now authenticated)
    const q = query(collection(db, 'families'), where('inviteCode', '==', inviteCode.toUpperCase()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error('INVALID_INVITE_CODE');
    }
    const familyDoc = snapshot.docs[0];
    const familyId = familyDoc.id;

    // 3. Add uid to family memberUids
    await updateDoc(doc(db, 'families', familyId), {
      memberUids: arrayUnion(uid),
    });

    const user: Omit<AppUser, 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any } = {
      uid,
      email,
      displayName,
      familyId,
      role: 'member',
      fcmTokens: [],
      notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'families', familyId, 'members', uid), user);
    await setDoc(doc(db, 'users', uid), { familyId });

    return { ...user, createdAt: new Date() as any, updatedAt: new Date() as any };
  } catch (e) {
    // Clean up the dangling auth account so the user can try again
    await credential.user.delete().catch(() => {});
    throw e;
  }
}

/** Sign in existing user and load their AppUser profile */
export async function loginUser(email: string, password: string): Promise<AppUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return loadUserProfile(credential.user);
}

/** Load AppUser profile from Firestore using the top-level users/{uid} index. */
export async function loadUserProfile(firebaseUser: User): Promise<AppUser> {
  const userIndexSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
  if (!userIndexSnap.exists()) {
    throw new Error('USER_NOT_IN_ANY_FAMILY');
  }
  const { familyId } = userIndexSnap.data() as { familyId: string };
  const memberSnap = await getDoc(
    doc(db, 'families', familyId, 'members', firebaseUser.uid)
  );
  if (!memberSnap.exists()) {
    throw new Error('MEMBER_DOC_NOT_FOUND');
  }
  return { ...memberSnap.data(), uid: firebaseUser.uid } as AppUser;
}

/** Load Family document from Firestore */
export async function loadFamily(familyId: string): Promise<Family | null> {
  const snap = await getDoc(doc(db, 'families', familyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Family;
}

export function logout() {
  return signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
