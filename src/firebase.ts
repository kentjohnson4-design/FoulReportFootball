import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Firebase web config is meant to be public: it identifies the project, it does not grant
// access. What protects the data is firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyBdIyE2lzaQYqz-Fycj56cb3Iq_g3ka5RM',
  authDomain: 'foul-report-football.firebaseapp.com',
  projectId: 'foul-report-football',
  storageBucket: 'foul-report-football.firebasestorage.app',
  messagingSenderId: '2594201741',
  appId: '1:2594201741:web:3a2651d17e57b0e4b582c4',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// The on-device cache lets the app read and write with no signal; writes upload later.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

export const usingEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';
if (usingEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
