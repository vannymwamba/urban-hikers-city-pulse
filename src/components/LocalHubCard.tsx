import React from 'react';
import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';

export type LocalHubTier = 'free' | 'paid' | 'premium';

export interface LocalHub {
  id: string;
  name: string;
  offer?: string;
  address: string;
  distance_mi?: number;
  tier: LocalHubTier;
  cover_url?: string;
  cta_url?: string;
  is_open?: boolean;
  is_live_deal?: boolean;
}

interface LocalHubCardProps {
  hub: LocalHub;
  idx: number;
  onRedeem?: (hub: LocalHub) => void;
}

export const LocalHubCard: React.FC<LocalHubCardProps> = ({ hub, idx, onRedeem }) => {
  const isPremium = hub.tier === 'premium';
  const isPaid    = hub.tier === 'paid';
  const isFree    = hub.tier === 'free';

  const borderStyle = isPremium
    ? '2px solid #FFE01A'
    : isPaid
    ? '1.5px solid #FFE01A'
    : '1px solid #2a2a2a';

  const cardWidth  = 'w-[240px]';
  const cardHeight = 'h-[200px]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={`${cardWidth} ${cardHeight} relative rounded-[32px] overflow-hidden flex-shrink-0 cursor-pointer snap-start bg-[#1a1a1a] group`}
      style={{ border: borderStyle }}
      onClick={() => hub.cta_url && window.open(hub.cta_url, '_blank')}
    >
      {/* Background image */}
      {hub.cover_url ? (
        <img
          src={hub.cover_url}
          alt={hub.name}
          className="absolute inset-0 w-full h-full object-cover opacity-55 transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="absolute inset-0 bg-[#111]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

      {/* Top badges */}
      <div className="absolute top-3 left-3 flex gap-2 z-10">
        {isPremium && hub.is_live_deal && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[#111] text-[9px] font-black uppercase tracking-widest"
               style={{ background: '#FFE01A' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse" />
            Live_Deal
          </div>
        )}

        {isPaid && !hub.is_live_deal && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
               style={{ background: '#FFE01A', color: '#111' }}>
            ⚡ Refuel
          </div>
        )}

        {isFree && (
          <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
               style={{ background: '#2a2a2a', color: '#888' }}>
            {hub.is_open ? 'Open_Now' : 'Closed'}
          </div>
        )}

        {(isPremium || isPaid) && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white text-[#111]">
            ★ Featured
          </div>
        )}
      </div>

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-3 z-10">
        <p className={`text-[15px] font-black uppercase tracking-tight leading-tight mb-1 ${isFree ? 'text-[#888]' : 'text-white'}`}>
          {hub.name}
        </p>

        {hub.offer && (
          <p className="text-[11px] font-black uppercase tracking-wider mb-2"
             style={{ color: isFree ? '#555' : '#FFE01A' }}>
            {hub.offer}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-hidden">
            <MapPin size={10} style={{ color: isFree ? '#555' : '#FFE01A', flexShrink: 0 }} />
            <span className="text-[10px] font-black uppercase tracking-tight truncate"
                  style={{ color: isFree ? '#555' : '#888' }}>
              {hub.address}
            </span>
            {hub.distance_mi !== undefined && (
              <>
                <span className="text-[10px] text-[#444] mx-0.5">·</span>
                <span className="text-[10px] font-black shrink-0"
                      style={{ color: isFree ? '#555' : '#FFE01A' }}>
                  {hub.distance_mi.toFixed(1)} mi
                </span>
              </>
            )}
          </div>

          {!isFree ? (
            <button
              onClick={(e) => { e.stopPropagation(); onRedeem?.(hub); }}
              className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex-shrink-0 transition-all hover:scale-105"
              style={{ background: '#FFE01A', color: '#111' }}
            >
              {hub.tier === 'premium' ? 'Redeem' : 'Visit'}
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onRedeem?.(hub); }}
              className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex-shrink-0 border"
              style={{ background: 'transparent', color: '#888', borderColor: '#333' }}
            >
              View
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
