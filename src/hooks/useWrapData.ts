import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WrapStats } from '../types/wrap';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

interface UseWrapDataResult {
  data: WrapStats | null;
  loading: boolean;
  error: string | null;
}

export function useWrapData(vendorId: string, season: string): UseWrapDataResult {
  const [data, setData] = useState<WrapStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId || !season) {
      setData(null);
      setLoading(false);
      setError('Missing vendor ID or season parameter.');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const docId = `${vendorId}_${season}`;
    const docPath = `wrap_summaries/${docId}`;
    const docRef = doc(db, 'wrap_summaries', docId);

    getDoc(docRef)
      .then((docSnap) => {
        if (!isMounted) return;
        if (docSnap.exists()) {
          setData(docSnap.data() as WrapStats);
        } else {
          setError(`No wrap summary found for ${vendorId} in ${season}`);
          setData(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Firestore error loading wrap data:", err);
        setError(err instanceof Error ? err.message : String(err));
        setData(null);
        setLoading(false);
        try {
          handleFirestoreError(err, OperationType.GET, docPath);
        } catch (_) {
          // Relayed to error state but logged by handleFirestoreError
        }
      });

    return () => {
      isMounted = false;
    };
  }, [vendorId, season]);

  return { data, loading, error };
}
