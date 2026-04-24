
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a');

async function checkDocs() {
  console.log('--- SCANNING FOR NON-STRING BROADCASTS ---');
  try {
    const snap = await getDocs(collection(db, 'broadcasts'));
    let found = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.expires_at && typeof data.expires_at !== 'string') {
        const type = (data.expires_at && typeof data.expires_at === 'object' && data.expires_at.toDate) ? 'Timestamp' : typeof data.expires_at;
        console.log(`ID: ${d.id} | Title: ${data.title} | Type: ${type} | Node: ${data.node_id || data.nodeId}`);
        found++;
      }
    });
    console.log(`TOTAL NON-STRING DOCS FOUND: ${found}`);
  } catch (err) {
    console.error('Query failed:', err);
  }
  process.exit(0);
}

checkDocs();
