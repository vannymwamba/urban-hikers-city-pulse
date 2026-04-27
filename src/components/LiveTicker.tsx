import React, { useEffect, useState, useRef } from 'react';
import { Tap, VibeReport, Broadcast } from '../types';

interface LiveTickerProps {
  taps: Tap[];
  vibeReports: VibeReport[];
  broadcasts: Broadcast[];
}

export const LiveTicker: React.FC<LiveTickerProps> = ({ taps, vibeReports, broadcasts }) => {
  const [items, setItems] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tickerItems: { text: string; time: number }[] = [
      ...taps.slice(0, 5).map(t => ({
        text: `NFC_TAP · NODE_${t.node_id?.slice(0, 6).toUpperCase()} · ${Math.round((Date.now() - new Date(t.timestamp).getTime()) / 1000)}s ago`,
        time: new Date(t.timestamp).getTime()
      })),
      ...vibeReports.slice(0, 5).map(v => ({
        text: `VIBE: ${v.vibe.toUpperCase()} · ${Math.round((Date.now() - new Date(v.reported_at || v.reportedAt).getTime()) / 1000)}s ago`,
        time: new Date(v.reported_at || v.reportedAt).getTime()
      })),
      ...broadcasts.slice(0, 5).map(b => ({
        text: `SIGNAL_LIVE · ${b.title.toUpperCase()} · READY`,
        time: new Date(b.created_at || Date.now()).getTime()
      }))
    ];

    setItems(tickerItems.sort((a, b) => b.time - a.time).map(i => i.text));
  }, [taps, vibeReports, broadcasts]);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (items.length > 0 ? (prev + 1) % items.length : 0));
    }, 3000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-9 bg-black z-[100] border-t border-uh-gray-800 flex items-center overflow-hidden">
      <div className="flex-shrink-0 bg-uh-yellow h-full flex items-center px-4">
        <span className="text-[9px] font-black tracking-widest text-black">LIVE_SIGNAL</span>
      </div>
      <div className="flex-1 overflow-hidden relative h-full flex items-center">
        <div 
          className="absolute inset-x-0 transition-transform duration-700 ease-in-out px-6"
          style={{ transform: `translateY(${-index * 100}%)` }}
        >
          {items.map((item, i) => (
            <div key={i} className="h-9 flex items-center">
              <span className="text-[8px] font-mono tracking-[0.14em] uppercase text-uh-yellow whitespace-nowrap">
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-shrink-0 px-4 text-uh-gray-600 text-[8px] font-mono border-l border-uh-gray-900 h-full flex items-center">
        UH_NETWORK_OK
      </div>
    </div>
  );
};
