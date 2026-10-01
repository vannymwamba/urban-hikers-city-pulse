import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { GlobalSponsors } from '../types';

const GlobalSponsorsContext = createContext<GlobalSponsors | null>(null);

export function GlobalSponsorsProvider({ children }: { children: React.ReactNode }) {
  const [sponsors, setSponsors] = useState<GlobalSponsors | null>(null);

  useEffect(() => {
    const docRef = doc(db, 'globalSponsors', 'config');
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setSponsors(snap.data() as GlobalSponsors);
        } else {
          setSponsors({});
        }
      },
      (err) => {
        console.error("Failed to listen to global sponsors / promoted book:", err);
        setSponsors({});
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <GlobalSponsorsContext.Provider value={sponsors}>
      {children}
    </GlobalSponsorsContext.Provider>
  );
}

export function useGlobalSponsors() {
  return useContext(GlobalSponsorsContext) || {};
}
