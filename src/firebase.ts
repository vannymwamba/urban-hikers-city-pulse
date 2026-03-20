import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use standard Firestore initialization. 
// Firebase will automatically handle persistence if possible, 
// or fallback to memory cache if IndexedDB is restricted or failing.
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;
