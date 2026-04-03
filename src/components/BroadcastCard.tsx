import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MapPin, Share2, ArrowRight, Clock } from 'lucide-react';
import { Broadcast, Partner, Node, Sponsor } from '../types';
import { getDistance } from '../utils/geo';
import { 
  getEventStatus, 
  getBadgeLabel, 
  getBadgeStyle 
} from '../utils/broadcastHelpers';

interface BroadcastCardProps {
  item: Broadcast;
  idx: number;
  currentNode: Node | null;
  onSelect: (broadcast: Broadcast) => void;
  onShareEvent: (broadcast: Broadcast) => void;
  partner: Partner | null;
  sponsor?: Sponsor | null;
  variant?: 'hero' | 'peek';
}

export const BroadcastCard: React.FC<BroadcastCardProps> = ({
  item,
  idx,
  currentNode,
  onSelect,
  onShareEvent,
  partner,
  variant = 'peek'
}) => {
  const [progress, setProgress] = useState(100);
  const isFlashDeal = item.type === 'flash_deal';
  const isMural = item.type === 'civic_mural';
  
  const distance = currentNode ? getDistance(
    currentNode.latitude,
    currentNode.longitude,
    item.latitude || 0,
    item.longitude || 0
  ) : 0;
  const walkTime = Math.ceil(distance / 80);
  const status = getEventStatus(item);

  useEffect(() => {
    if (!isFlashDeal) return;
    
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
  }, [item, isFlashDeal]);

  const cardHeight = variant === 'hero' ? 'h-[260px]' : 'h-[200px]';
  const cardWidth = variant === 'hero' ? 'w-full' : 'w-[85vw] max-w-[340px]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      onClick={() => onSelect(item)}
      className={`relative ${cardWidth} ${cardHeight} rounded-[20px] overflow-hidden group cursor-pointer shadow-xl flex-shrink-0 snap-start`}
    >
      {/* Photo Background */}
      <img 
        src={item.imageUrl || `https://picsum.photos/seed/${item.id}/800/500`} 
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover opacity-45 transition-transform duration-700 group-hover:scale-105"
        referrerPolicy="no-referrer"
      />
      
      {/* Dark Gradient Overlay (bottom-weighted) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
      
      {/* Top Corners: Status + Type/Timer */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        <div className="flex flex-col gap-2">
          {isFlashDeal ? (
            <div className="bg-[#FF3B30] text-white text-[10px] font-black px-3 py-1 rounded-[20px] uppercase tracking-widest font-mono shadow-lg flex items-center gap-2 animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              LIVE NOW
            </div>
          ) : (
            <div className={`text-[10px] font-black px-3 py-1 rounded-[20px] uppercase tracking-widest font-mono shadow-lg ${getBadgeStyle(item)}`}>
              {getBadgeLabel(item)}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {isFlashDeal && (
            <div className="bg-uh-yellow text-uh-black text-[9px] font-black px-2.5 py-1 rounded-[20px] uppercase tracking-tight font-mono shadow-lg">
              NFC_CLAIM_READY
            </div>
          )}
          {!isMural && (
            <div className="bg-black/40 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-[20px] uppercase tracking-widest font-mono border border-white/10 flex items-center gap-1.5">
              <Clock size={12} className="text-uh-yellow" />
              <span className="font-variant-numeric-tabular-nums">
                {status.countdownText || '00:00:00'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-col">
            <span className="text-uh-yellow text-[10px] font-black font-mono uppercase tracking-widest mb-0.5">
              {partner?.name || item.partner_id || 'LOCAL_PARTNER'}
            </span>
            <h3 className={`text-white ${variant === 'hero' ? 'text-2xl' : 'text-xl'} font-black tracking-tighter uppercase leading-none truncate`}>
              {item.title}
            </h3>
          </div>

          {isFlashDeal && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: "linear" }}
                  className="h-full bg-uh-yellow shadow-[0_0_8px_#FFE01A]"
                />
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-[20px] border border-white/10">
                    <MapPin size={10} className="text-uh-yellow" />
                    <span className="text-[9px] font-black text-white uppercase tracking-tighter font-mono">{walkTime} MIN</span>
                  </div>
                </div>
                <button className="bg-uh-yellow text-uh-black px-5 py-2 rounded-[24px] text-[11px] font-black uppercase tracking-widest shadow-lg shadow-uh-yellow/20 hover:scale-105 transition-transform">
                  Claim ${item.discount_value || '5'} Off
                </button>
              </div>
            </div>
          )}

          {!isFlashDeal && (
            <div className="flex justify-between items-end mt-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-[20px] border border-white/10">
                  <MapPin size={10} className="text-uh-yellow" />
                  <span className="text-[9px] font-black text-white uppercase tracking-tighter font-mono">{walkTime} MIN</span>
                </div>
                {isMural && (
                  <div className="bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-[20px] border border-white/10">
                    <span className="text-[9px] font-black text-white uppercase tracking-tighter font-mono">MURAL</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareEvent(item);
                  }}
                  className="p-2 text-white/60 hover:text-white transition-colors bg-white/10 rounded-full backdrop-blur-md"
                >
                  <Share2 size={14} />
                </button>
                <div className="w-8 h-8 rounded-full bg-uh-yellow flex items-center justify-center shadow-lg shadow-uh-yellow/20 group-hover:scale-110 transition-transform">
                  <ArrowRight size={18} className="text-uh-black" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
