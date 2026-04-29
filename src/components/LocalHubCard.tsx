import React from 'react';
import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';
import { LocalHub } from '../types';

export type LocalHubTier = 'free' | 'paid' | 'premium';

interface LocalHubCardProps {
  hub: LocalHub;
  idx: number;
  onRedeem?: (hub: LocalHub) => void;
}

export const LocalHubCard: React.FC<LocalHubCardProps> = ({ hub, idx, onRedeem }) => {
  const isPremium = hub.tier === 'premium';
  const isPaid    = hub.tier === 'paid';
  const isFree    = hub.tier === 'free';

  const checkIsOpen = () => {
    if (!hub.operating_hours) return hub.is_open ?? true;

    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hours = hub.operating_hours[day];

    if (!hours) return false;

    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);

    const openDate = new Date(now);
    openDate.setHours(openH, openM, 0, 0);

    const closeDate = new Date(now);
    closeDate.setHours(closeH, closeM, 0, 0);

    return now >= openDate && now < closeDate;
  };

  const isOpen = checkIsOpen();

  const borderStyle = isPremium
    ? '2px solid #FFE01A'
    : isPaid
    ? '1.5px solid #FFE01A'
    : '1px solid #2a2a2a';

  const cardWidth  = 'w-[240px]';
  const cardHeight = 'h-[200px]';

  const openDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    const query = encodeURIComponent(`${hub.name} ${hub.address}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={`${cardWidth} ${cardHeight} relative rounded-[32px] overflow-hidden flex-shrink-0 cursor-pointer snap-start bg-[#1a1a1a] group`}
      style={{ border: borderStyle }}
      onClick={openDirections}
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

      {/* Hover action indicator */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
        <div className="bg-[#FFE01A] text-[#111] px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl">
          <MapPin size={12} />
          Directions
        </div>
      </div>

      {/* Top badges */}
      <div className="absolute top-3 left-3 flex gap-2 z-10">
        {(!isOpen) && (
          <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-[#111] text-error flex items-center gap-1.5 border border-error/30">
            <span className="w-1.5 h-1.5 rounded-full bg-error" />
            Closed
          </div>
        )}

        {isOpen && isPremium && hub.is_live_deal && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[#111] text-[9px] font-black uppercase tracking-widest"
               style={{ background: '#FFE01A' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse" />
            Live_Deal
          </div>
        )}

        {isOpen && isPaid && !hub.is_live_deal && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
               style={{ background: '#FFE01A', color: '#111' }}>
            ⚡ Refuel
          </div>
        )}

        {isOpen && isFree && (
          <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
               style={{ background: '#2a2a2a', color: '#888' }}>
            Open_Now
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
            <div className="flex flex-col gap-0.5 overflow-hidden">
              <div className="flex items-center gap-1 overflow-hidden">
                <MapPin size={10} style={{ color: isFree ? '#555' : '#FFE01A', flexShrink: 0 }} />
                <span className="text-[9px] font-black uppercase tracking-tight truncate max-w-[120px]"
                      style={{ color: isFree ? '#555' : '#888' }}>
                  {hub.address}
                </span>
              </div>
              {hub.distance_mi !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-[12px] font-black"
                        style={{ color: isFree ? '#555' : '#FFE01A' }}>
                    {hub.distance_mi.toFixed(1)} mi
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-uh-gray-400">Away</span>
                </div>
              )}
            </div>

            {hub.cta_url && (
              <button
                onClick={(e) => { e.stopPropagation(); onRedeem?.(hub); }}
                className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex-shrink-0 transition-all hover:scale-105 shadow-lg"
                style={{ background: '#FFE01A', color: '#111' }}
              >
                {hub.tier === 'premium' ? 'Redeem' : 'Visit'}
              </button>
            )}
          </div>
      </div>
    </motion.div>
  );
};
