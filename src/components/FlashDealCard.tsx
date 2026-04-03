import React from 'react';
import { motion } from 'motion/react';
import { Broadcast, Partner, Node } from '../types';
import { BroadcastCountdown } from './BroadcastCountdown';

interface FlashDealCardProps {
  item: Broadcast;
  idx: number;
  currentNode: Node | null;
  onSelect: (broadcast: Broadcast) => void;
  partner: Partner | null;
}

export const FlashDealCard: React.FC<FlashDealCardProps> = ({
  item,
  idx,
  currentNode,
  onSelect,
  partner
}) => {
  const [progress, setProgress] = React.useState(100);

  React.useEffect(() => {
    const start = new Date(item.startsAt || item.starts_at || 0).getTime();
    const end = new Date(item.expiresAt || item.expires_at || 0).getTime();
    
    if (isNaN(start) || isNaN(end)) return;

    const updateProgress = () => {
      const now = Date.now();
      const total = end - start;
      const remaining = end - now;
      const p = Math.max(0, Math.min(100, (remaining / total) * 100));
      setProgress(p);
    };

    updateProgress();
    const timer = setInterval(updateProgress, 1000);
    return () => clearInterval(timer);
  }, [item]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.1 }}
      onClick={() => onSelect(item)}
      className="relative w-full h-[260px] rounded-[32px] overflow-hidden group cursor-pointer shadow-2xl flex-shrink-0 snap-center"
    >
      {/* Photo Background */}
      <img 
        src={item.imageUrl || `https://picsum.photos/seed/${item.id}/800/500`} 
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover opacity-45 transition-transform duration-700 group-hover:scale-110"
        referrerPolicy="no-referrer"
      />
      
      {/* Dark Gradient Overlay (bottom-weighted) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      
      {/* Top Corners: Live Now + Countdown */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        <div className="bg-uh-magenta text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest font-mono shadow-lg flex items-center gap-2 animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
          LIVE NOW
        </div>
        <div className="bg-black/40 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest font-mono border border-white/10">
          <BroadcastCountdown broadcast={item} hideLabel hideProgress />
        </div>
      </div>

      {/* NFC Claim Label */}
      <div className="absolute top-14 right-4">
        <div className="bg-uh-yellow text-uh-black text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight font-mono shadow-lg">
          NFC_CLAIM_READY
        </div>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <span className="text-uh-yellow text-[10px] font-black font-mono uppercase tracking-widest mb-1">
              {partner?.name || item.partner_id || 'LOCAL_PARTNER'}
            </span>
            <h3 className="text-white text-3xl font-black tracking-tighter uppercase leading-none truncate">
              {item.title}
            </h3>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
            <motion.div 
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "linear" }}
              className="h-full bg-uh-yellow shadow-[0_0_10px_#FFE01A]"
            />
          </div>

          <div className="flex justify-between items-center mt-2">
             <div className="text-[10px] text-uh-gray-400 font-mono uppercase tracking-widest">
               TIME_BURNING_DOWN
             </div>
             <button className="bg-uh-yellow text-uh-black px-6 py-2.5 rounded-full text-[12px] font-black uppercase tracking-widest shadow-lg shadow-uh-yellow/20 hover:scale-105 transition-transform">
               Claim ${item.discount_value || '5'} Off
             </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
