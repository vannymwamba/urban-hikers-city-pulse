import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { VibeReport, Vibe } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

interface MiniVibeTrendProps {
  broadcastId: string;
}

const VIBE_VALUES: Record<Vibe, number> = {
  'chill': 1,
  'buzzing': 2,
  'packed': 3
};

export const MiniVibeTrend: React.FC<MiniVibeTrendProps> = ({ broadcastId }) => {
  const [trend, setTrend] = useState<'up' | 'down' | 'stable' | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'vibe_reports'),
      where('broadcast_id', '==', broadcastId),
      orderBy('reported_at', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => doc.data() as VibeReport);
      if (reports.length < 2) {
        setTrend(null);
        setHistory([]);
        return;
      }

      const values = reports.map(r => VIBE_VALUES[r.vibe]).reverse();
      setHistory(values);

      const first = values[0];
      const last = values[values.length - 1];

      if (last > first) setTrend('up');
      else if (last < first) setTrend('down');
      else setTrend('stable');
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'vibe_reports'));

    return () => unsubscribe();
  }, [broadcastId]);

  if (history.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5 ml-2">
      <div className="flex items-end gap-0.5 h-3">
        {history.map((val, i) => (
          <div 
            key={i}
            className={`w-1 rounded-sm transition-all duration-500 ${
              trend === 'up' ? 'bg-hud-teal' : 
              trend === 'down' ? 'bg-hud-coral' : 
              'bg-hud-amber'
            }`}
            style={{ 
              height: `${(val / 3) * 100}%`,
              opacity: 0.3 + (i / history.length) * 0.7
            }}
          />
        ))}
      </div>
      {trend === 'up' && <span className="text-[8px] font-black text-hud-teal font-mono">↑</span>}
      {trend === 'down' && <span className="text-[8px] font-black text-hud-coral font-mono">↓</span>}
      {trend === 'stable' && <span className="text-[8px] font-black text-hud-amber font-mono">→</span>}
    </div>
  );
};
