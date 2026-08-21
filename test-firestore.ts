import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import config from './src/firebase-config-dev.json' with { type: 'json' };

const app = initializeApp(config);
const db = getFirestore(app);

getDoc(doc(db, 'globalSponsors', 'config'))
  .then(snap => {
    console.log("Exists:", snap.exists());
    if (snap.exists()) console.log(snap.data());
    process.exit(0);
  })
  .catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
  });
