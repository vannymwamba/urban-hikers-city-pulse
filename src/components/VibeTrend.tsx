import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { VibeReport, Vibe } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

interface VibeTrendProps {
  broadcastId: string;
}

const VIBE_VALUES: Record<Vibe, number> = {
  'chill': 1,
  'buzzing': 2,
  'packed': 3
};

const VIBE_LABELS: Record<number, string> = {
  1: 'CHILL',
  2: 'BUZZING',
  3: 'PACKED'
};

export const VibeTrend: React.FC<VibeTrendProps> = ({ broadcastId }) => {
  const [data, setData] = useState<{ time: string; value: number; originalVibe: Vibe }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'vibe_reports'),
      where('broadcast_id', '==', broadcastId),
      orderBy('reported_at', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VibeReport[];

      // Sort by time ascending for the chart
      const chartData = reports
        .sort((a, b) => new Date(a.reported_at).getTime() - new Date(b.reported_at).getTime())
        .map(r => ({
          time: format(new Date(r.reported_at), 'HH:mm'),
          value: VIBE_VALUES[r.vibe],
          originalVibe: r.vibe
        }));

      setData(chartData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'vibe_reports');
    });

    return () => unsubscribe();
  }, [broadcastId]);

  if (loading) return <div className="h-32 flex items-center justify-center text-[9px] text-[#444] animate-pulse uppercase tracking-[0.2em]">Analyzing_Streams...</div>;
  if (data.length < 2) return <div className="h-32 flex items-center justify-center text-[9px] text-[#222] border border-dashed border-white/5 uppercase tracking-[0.2em]">Insufficient_Data</div>;

  return (
    <div className="mt-4">
      <div className="h-32 w-full border border-white/5 bg-black/40 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorVibe" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFE01A" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#FFE01A" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              hide 
            />
            <YAxis 
              domain={[1, 3]} 
              ticks={[1, 2, 3]}
              hide
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#111] border border-white/10 p-3 text-[9px] font-mono">
                      <div className="text-[#444] uppercase tracking-widest">{payload[0].payload.time}</div>
                      <div className="text-uh-yellow font-bold uppercase tracking-[0.1em]">{VIBE_LABELS[payload[0].value as number]}</div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#FFE01A" 
              strokeOpacity={0.4}
              fillOpacity={1} 
              fill="url(#colorVibe)" 
              strokeWidth={1.5}
              isAnimationActive={true}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
