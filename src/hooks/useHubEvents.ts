import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Broadcast } from '../types';

/**
 * React hook to fetch real-time events for a specific hub.
 */
export function useHubEvents(hubId: string) {
  const [events, setEvents] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hubId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    console.log(`[visit-cincy] Subscribing to events for hub: ${hubId}`);
    
    // Query broadcasts: where sectorId == hubId, active == true, startTime >= now, orderBy startTime asc
    const now = Timestamp.now();
    const q = query(
      collection(db, 'broadcasts'),
      where('sectorId', '==', hubId),
      where('active', '==', true),
      where('startTime', '>=', now),
      orderBy('startTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Broadcast[];
      
      setEvents(eventData);
      setLoading(false);
    }, (error) => {
      console.error(`[visit-cincy] Error fetching hub events for ${hubId}:`, error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [hubId]);

  return { events, loading };
}
