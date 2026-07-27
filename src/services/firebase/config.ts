import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, type Auth, type Persistence } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// getReactNativePersistence ships only in the React Native build of firebase/auth,
// so it is absent from the default type definitions. Metro resolves the real
// implementation at runtime; we reach it here through a typed cast.
const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence: (storage: unknown) => Persistence;
  }
).getReactNativePersistence;

/**
 * Firebase configuration.
 *
 * HOW TO FILL THIS IN:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (or open existing)
 * 3. Click the </> (Web) icon to add a web app
 * 4. Copy the firebaseConfig values here
 * 5. Also download google-services.json and place it at project root
 *    (required for Android push notifications)
 *
 * NEVER commit real credentials to git.
 * Use a .env.local file and process.env, or replace these strings locally.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyCgkY_lgpYP_65RTJ2SwzfFQFlY2uF8GM8',
  authDomain: 'petcontrol-ac39f.firebaseapp.com',
  projectId: 'petcontrol-ac39f',
  storageBucket: 'petcontrol-ac39f.firebasestorage.app',
  messagingSenderId: '429584450443',
  appId: '1:429584450443:web:1eef23b404a321d692e58e',
};

// Prevent duplicate initialization in Expo hot-reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage persistence so the signed-in session
// survives app restarts. Plain getAuth() uses in-memory persistence on React
// Native, which would sign the user out every time the app is closed.
let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // initializeAuth throws if it was already initialized (e.g. Fast Refresh).
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
