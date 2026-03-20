import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Share2, ArrowRight } from 'lucide-react';
import { Broadcast, Partner, Node, Sponsor } from '../types';
import { getDistance } from '../utils/geo';
import { MiniVibeTrend } from './MiniVibeTrend';
import { BroadcastCountdown } from './BroadcastCountdown';
import { SponsorBadge } from './SponsorBadge';
import { 
  getIcon, 
  getIconBg, 
  getEventStatus, 
  getBadgeLabel, 
  getBadgeStyle, 
  getDotColor 
} from '../utils/broadcastHelpers';

interface BroadcastCardProps {
  item: Broadcast;
  idx: number;
  currentNode: Node | null;
  onSelect: (broadcast: Broadcast) => void;
  onShareEvent: (broadcast: Broadcast) => void;
  handleDirections: (broadcast: Broadcast) => void;
  partner: Partner | null;
  sponsor?: Sponsor | null;
}

export const BroadcastCard: React.FC<BroadcastCardProps> = ({
  item,
  idx,
  currentNode,
  onSelect,
  onShareEvent,
  handleDirections,
  partner,
  sponsor
}) => {
  const distance = currentNode ? getDistance(
    currentNode.latitude,
    currentNode.longitude,
    item.latitude,
    item.longitude
  ) : 0;
  const walkTime = Math.ceil(distance / 80);
  const status = getEventStatus(item);
  const hasSponsorship = partner && (partner.logo_url || partner.brand_color);
  const brandColor = partner?.brand_color ?? '#FFE01A';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={`bg-white mb-3 shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden ${!status.isLive ? 'opacity-70' : ''}`}
      style={{
        borderRadius: '10px',
        border: hasSponsorship 
          ? `2px solid ${brandColor}99` // ~60% opacity hex
          : '1px solid var(--md-sys-color-outline)'
      }}
    >
      {/* Zone A: Sponsor Bar */}
      <SponsorBadge partner={partner} zone="A" />

      <div className="p-4" onClick={() => onSelect(item)}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getIconBg(item)}`}>
              {getIcon(item)}
            </div>
            <div>
              <div className="text-[14px] font-bold text-[#1A1A1A] leading-tight mb-0.5 font-sans">{item.title}</div>
              <div className="text-[11px] text-[#888780] font-medium uppercase tracking-wide flex items-center gap-2 font-mono">
                <span>{item.partner_id === 'admin' ? 'SYSTEM_ADMIN' : (partner?.name || item.partner_id || 'LOCAL_PARTNER')}</span>
                <span className="w-1 h-1 rounded-full bg-[#888780]/30" />
                <span className="text-[#1A1A1A]/60">
                  {status.time}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 font-mono ${getBadgeStyle(item)}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${getDotColor(item)}`} />
              {getBadgeLabel(item)}
            </span>
            {status.isLive && <MiniVibeTrend broadcastId={item.id} />}
          </div>
        </div>

        <BroadcastCountdown broadcast={item} />
        
        {/* Zone D: Deal Text */}
        <SponsorBadge partner={partner} zone="D" />
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-[#F8F7F4] border-t border-[#F0EEE8]">
        <div className="flex flex-col gap-1">
          {item.address && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#2C2C2A] font-semibold font-sans">
              <MapPin size={12} className="text-[#888780]" />
              {item.address.split(',')[0]}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#1A2B4A] px-2 py-0.5 rounded-full">
              <span className="text-[9px] font-black text-hud-yellow uppercase tracking-tighter font-mono">{walkTime} MIN WALK</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item);
            }}
            className="flex items-center gap-1.5 bg-white border border-[#D3D1C7] text-[#1A1A1A] px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#F0EEE8] transition-colors"
          >
            READ MORE
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onShareEvent(item);
            }}
            className="flex items-center gap-1.5 bg-white border border-[#D3D1C7] text-[#888780] px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#F0EEE8] transition-colors"
          >
            <Share2 size={12} />
            SHARE
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDirections(item);
            }}
            className="flex items-center gap-1.5 bg-[#1A2B4A] text-hud-yellow px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            DIRECTIONS
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
