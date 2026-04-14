import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
