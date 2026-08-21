import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { GlobalSponsors } from '../types';

const GlobalSponsorsContext = createContext<GlobalSponsors | null>(null);

export function GlobalSponsorsProvider({ children }: { children: React.ReactNode }) {
  const [sponsors, setSponsors] = useState<GlobalSponsors | null>(null);

  useEffect(() => {
    const fetchSponsors = async () => {
      try {
        const docRef = doc(db, 'globalSponsors', 'config');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setSponsors(snap.data() as GlobalSponsors);
        } else {
          setSponsors({});
        }
      } catch (err) {
        console.error("Failed to load global sponsors", err);
        setSponsors({});
      }
    };
    fetchSponsors();
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
