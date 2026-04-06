import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MapPin, Share2, ArrowRight, Clock, Heart } from 'lucide-react';
import { Broadcast, Partner, Node, Sponsor, BroadcastType } from '../types';
import { getDistance } from '../utils/geo';
import { 
  getEventStatus, 
  getCategoryTag,
  getStatusTag,
  getDotColor
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
  const isFlashDeal = item.type === BroadcastType.FLASH_DEAL;
  const isWalkingEvent = item.type === BroadcastType.WALKING_EVENT;
  const isAllNodes = item.scope === 'all_nodes';
  
  const distance = currentNode ? getDistance(
    currentNode.latitude,
    currentNode.longitude,
    item.latitude || 0,
    item.longitude || 0
  ) : 0;
  const walkTime = Math.ceil(distance / 80);
  const status = getEventStatus(item);
  const categoryTag = getCategoryTag(item);
  const statusTag = getStatusTag(item);

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

  const cardHeight = variant === 'hero' ? 'h-[280px]' : 'h-[220px]';
  const cardWidth = variant === 'hero' ? 'w-full' : 'w-[85vw] max-w-[340px]';

  const handleCTA = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.payment_type === 'stripe' || isWalkingEvent) {
      // Trigger booking/payment logic
      console.log('Triggering payment for:', item.title);
    } else if (item.payment_type === 'tip_jar' && item.tip_url) {
      window.open(item.tip_url, '_blank');
    } else {
      onSelect(item);
    }
  };

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
        src={item.cover_url || item.imageUrl || `https://picsum.photos/seed/${item.type}/800/500`} 
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover opacity-50 transition-transform duration-700 group-hover:scale-105"
        referrerPolicy="no-referrer"
      />
      
      {/* Dark Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
      
      {/* Top Corners: Status + Category + Time */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        <div className="flex gap-2">
          {/* Status Tag */}
          <div className={`${statusTag.bg} ${statusTag.text} text-[10px] font-black px-3 py-1 rounded-[20px] uppercase tracking-widest font-mono shadow-lg flex items-center gap-2`}>
            {status.isLive && statusTag.label === 'LIVE_NOW' && (
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
            {statusTag.label.replace('_', ' ')}
          </div>
          
          {/* Category Tag */}
          <div className={`${categoryTag.bg} ${categoryTag.text} text-[10px] font-black px-3 py-1 rounded-[20px] uppercase tracking-widest font-mono shadow-lg`}>
            {categoryTag.label}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isAllNodes && (
            <div className="bg-[#FF3B30] text-white text-[9px] font-black px-2.5 py-1 rounded-[20px] uppercase tracking-tight font-mono shadow-lg animate-pulse">
              ALL NODES
            </div>
          )}
          <div className="bg-black/40 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-[20px] uppercase tracking-widest font-mono border border-white/10 flex items-center gap-1.5">
            <span className="font-variant-numeric-tabular-nums">
              {status.time}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="text-uh-yellow text-[10px] font-black font-mono uppercase tracking-widest mb-0.5">
            {partner?.name || item.partner_id || 'LOCAL_PARTNER'}
          </span>
          <h3 className={`text-white ${variant === 'hero' ? 'text-2xl' : 'text-xl'} font-black tracking-tighter uppercase leading-none truncate`}>
            {item.title}
          </h3>
        </div>

        {/* Walking Event Details */}
        {isWalkingEvent && (
          <div className="flex gap-2 flex-wrap">
            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-[20px] border border-white/10 text-[10px] font-black text-white font-mono">
              ${item.price || 0}
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-[20px] border border-white/10 text-[10px] font-black text-white font-mono">
              {item.spots_remaining || 0} SPOTS LEFT
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-[20px] border border-white/10 text-[10px] font-black text-white font-mono">
              NFC CHECK-IN
            </div>
          </div>
        )}

        {/* Flash Deal Progress */}
        {isFlashDeal && (
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "linear" }}
              className="h-full bg-uh-yellow shadow-[0_0_8px_#FFE01A]"
            />
          </div>
        )}

        {/* Tip Jar Band */}
        {item.payment_type === 'tip_jar' && item.tip_url && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              window.open(item.tip_url!, '_blank');
            }}
            className="bg-[#FFE01A]/12 border border-[#FFE01A]/20 rounded-[12px] p-2 flex items-center justify-between group/tip hover:bg-[#FFE01A]/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span role="img" aria-label="heart">💛</span>
              <span className="text-[#FFE01A] text-[11px] font-bold uppercase tracking-tight">
                Support {item.title} — Tip via Venmo
              </span>
            </div>
            <ArrowRight size={12} className="text-[#FFE01A] group-hover/tip:translate-x-1 transition-transform" />
          </div>
        )}

        {/* Footer Row */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-1 rounded-[20px] border border-white/10">
              <MapPin size={10} className="text-uh-yellow" />
              <span className="text-[9px] font-black text-white uppercase tracking-tighter font-mono">
                {item.meeting_point || item.venue || 'Washington Park'} · {walkTime} MIN
              </span>
            </div>
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
            
            <button 
              onClick={handleCTA}
              className={`px-5 py-2 rounded-[24px] text-[11px] font-black uppercase tracking-widest shadow-lg transition-transform hover:scale-105 ${
                isWalkingEvent ? 'bg-[#10B981] text-white shadow-[#10B981]/20' : 
                isFlashDeal ? 'bg-uh-yellow text-uh-black shadow-uh-yellow/20' :
                'bg-uh-yellow text-uh-black shadow-uh-yellow/20'
              }`}
            >
              {isWalkingEvent ? `BOOK — $${item.price}` : 
               isFlashDeal ? `CLAIM $${item.discount_value || '5'} OFF` : 
               'VIEW'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
