import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const app = initializeApp(require('./src/firebase-config-dev.json'));
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
