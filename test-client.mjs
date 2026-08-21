import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, limit, query } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const snap = await getDocs(query(collection(db, 'nodes'), limit(1)));
    console.log('Nodes get success:', snap.size);
    const docRef = await addDoc(collection(db, 'broadcasts'), {
      title: 'Test Broadcast',
      server_token: 'URBAN_HIKERS_SERVER_SECRET_2026'
    });
    console.log('Written test doc:', docRef.id);
  } catch(e) {
    console.error('Error:', e);
  }
}
run();
