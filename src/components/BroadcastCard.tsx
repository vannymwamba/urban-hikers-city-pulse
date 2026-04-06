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
  const isFoodTruck = item.type === BroadcastType.FOOD_TRUCK;
  const isPopUp = item.type === BroadcastType.POP_UP;
  const isStreetArt = item.type === BroadcastType.STREET_ART || item.type === BroadcastType.MURAL;
  const isLiveEvent = item.type === BroadcastType.LIVE_EVENT;
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

  const cardHeight = variant === 'hero' ? 'h-[320px]' : 'h-[260px]';
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
      className={`relative ${cardWidth} ${cardHeight} rounded-[32px] overflow-hidden group cursor-pointer shadow-2xl flex-shrink-0 snap-start border border-white/5`}
    >
      {/* Photo Background */}
      <img 
        src={item.cover_url || item.imageUrl || `https://picsum.photos/seed/${item.type}/800/500`} 
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
        referrerPolicy="no-referrer"
      />
      
      {/* Dark Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
      
      {/* Top Corners: Status + Category + Time */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        <div className="flex gap-2">
          {/* Status Tag */}
          <div className={`${statusTag.bg} ${statusTag.text} text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest font-mono shadow-lg flex items-center gap-2`}>
            {status.isLive && statusTag.label !== 'ALWAYS_ON' && (
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
            {statusTag.label.replace('_', ' ')}
          </div>
          
          {/* Category Tag */}
          <div className="bg-white/10 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest font-mono border border-white/10">
            {categoryTag.label}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isAllNodes && (
            <div className="bg-[#FF3B30] text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight font-mono shadow-lg animate-pulse">
              ALL NODES
            </div>
          )}
          <div className="bg-black/40 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest font-mono border border-white/10 flex items-center gap-1.5">
            <span className="font-variant-numeric-tabular-nums">
              {status.label === 'ALWAYS_ON' ? 'ALWAYS ON' : status.time}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="text-uh-yellow text-[10px] font-black font-mono uppercase tracking-widest mb-1">
            {partner?.name || item.partner_id || 'LOCAL_PARTNER'}
          </span>
          <h3 className={`text-white ${variant === 'hero' ? 'text-3xl' : 'text-2xl'} font-black tracking-tighter uppercase leading-none truncate`}>
            {item.title}
          </h3>
        </div>

        {/* Dynamic Badges based on Type */}
        <div className="flex gap-2 flex-wrap">
          {isWalkingEvent && (
            <>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-white font-mono">
                ${item.price || 0} / PERSON
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-white font-mono">
                {item.spots_remaining || 0} SPOTS LEFT
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-white font-mono">
                NFC CHECK-IN
              </div>
            </>
          )}
          {isFoodTruck && (
            <>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-white font-mono">
                VENMO READY
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-white font-mono">
                CASHAPP $LBK
              </div>
            </>
          )}
          {isFlashDeal && (
            <>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-white font-mono">
                TAP NFC TO CLAIM
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-white font-mono">
                {item.claim_limit || 12} REMAINING
              </div>
            </>
          )}
          {isStreetArt && (
            <>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-white font-mono">
                PERMANENT INSTALL
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-white font-mono">
                NFC AUDIO GUIDE
              </div>
            </>
          )}
        </div>

        {/* Flash Deal Progress */}
        {isFlashDeal && (
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "linear" }}
              className="h-full bg-uh-yellow shadow-[0_0_10px_#FFE01A]"
            />
          </div>
        )}

        {/* Tip Jar / Info Band */}
        {(item.payment_type === 'tip_jar' || isPopUp) && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              if (item.tip_url) window.open(item.tip_url, '_blank');
            }}
            className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between group/tip hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span role="img" aria-label="info">{isPopUp ? '📸' : '💛'}</span>
              <span className="text-white/80 text-[11px] font-bold uppercase tracking-tight">
                {isPopUp ? 'Follow on IG for live drops' : `Support ${item.title} — Tip via Venmo`}
              </span>
            </div>
            <ArrowRight size={12} className="text-white/40 group-hover/tip:translate-x-1 transition-transform" />
          </div>
        )}

        {/* Footer Row */}
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <MapPin size={10} className="text-uh-yellow" />
              <span className="text-[10px] font-black text-white uppercase tracking-tighter font-mono">
                {item.meeting_point || item.venue || item.address || 'Washington Park'} · {walkTime} MIN
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onShareEvent(item);
              }}
              className="p-2.5 text-white/60 hover:text-white transition-colors bg-white/10 rounded-full backdrop-blur-md border border-white/10"
            >
              <Share2 size={16} />
            </button>
            
            <button 
              onClick={handleCTA}
              className={`px-6 py-2.5 rounded-full text-[12px] font-black uppercase tracking-widest shadow-lg transition-transform hover:scale-105 ${
                isWalkingEvent ? 'bg-[#10B981] text-white shadow-[#10B981]/20' : 
                isFlashDeal ? 'bg-uh-yellow text-uh-black shadow-uh-yellow/20' :
                isFoodTruck ? 'bg-[#F97316] text-white shadow-[#F97316]/20' :
                isPopUp ? 'bg-[#0EA5E9] text-white shadow-[#0EA5E9]/20' :
                'bg-uh-yellow text-uh-black shadow-uh-yellow/20'
              }`}
            >
              {isWalkingEvent ? `BOOK — $${item.price}` : 
               isFlashDeal ? `CLAIM $${item.discount_value || '5'} OFF` : 
               isFoodTruck ? 'ORDER NOW' :
               isPopUp ? 'VISIT NOW' :
               isStreetArt ? 'GO' :
               'JOIN FREE'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
