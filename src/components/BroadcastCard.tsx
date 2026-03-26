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
  onBook?: (broadcast: Broadcast) => void;
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
  onBook,
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
  
  const logoUrl = partner?.logoUrl || partner?.logo_url;
  const brandColor = partner?.brandColor || partner?.brand_color || '#FFE01A';
  const sponsorZones = partner?.sponsorZones || partner?.sponsor_zones || [];
  const hasSponsorship = partner && (logoUrl || brandColor);

  // Zone E: Card Border
  const showBorder = hasSponsorship && sponsorZones.includes('E');
  // Zone B: Icon Background
  const showIconBg = hasSponsorship && sponsorZones.includes('B');
  // Zone C: Partner Name Color
  const showPartnerColor = hasSponsorship && sponsorZones.includes('C');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={`bg-navy-mid mb-2 shadow-lg transition-all cursor-pointer group overflow-hidden relative border border-white/5 ${!status.isLive ? 'opacity-60' : ''}`}
      style={{
        borderRadius: '2px',
        borderLeft: status.isLive ? '4px solid var(--color-live)' : '1px solid rgba(255,255,255,0.05)'
      }}
    >
      {/* Zone A: Sponsor Bar */}
      <SponsorBadge partner={partner} zone="A" />

      <div className="p-3" onClick={() => onSelect(item)}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-3">
            <div 
              className={`w-10 h-10 flex items-center justify-center shrink-0 border border-white/10 ${!showIconBg ? getIconBg(item) : ''}`}
              style={showIconBg ? { backgroundColor: brandColor } : {}}
            >
              {getIcon(item)}
            </div>
            <div className="flex flex-col">
              <div className="text-[14px] font-black text-white leading-none mb-1 uppercase tracking-tight font-mono">{item.title}</div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-hud-yellow uppercase tracking-[0.15em] font-mono">
                  {item.partner_id === 'admin' ? 'SYSTEM_ADMIN' : (partner?.name || item.partner_id || 'LOCAL_PARTNER')}
                </span>
                <span className="text-[9px] text-white/30 font-black font-mono">
                  // {status.time}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest font-mono ${getBadgeStyle(item)}`}>
              {getBadgeLabel(item)}
            </span>
            {status.isLive && <MiniVibeTrend broadcastId={item.id} />}
          </div>
        </div>

        <div className="mt-3">
          <BroadcastCountdown broadcast={item} />
        </div>
        
        {/* Zone D: Deal Text */}
        <SponsorBadge partner={partner} zone="D" />
      </div>

      <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-t border-white/5">
        <div className="flex items-center gap-4">
          {item.address && (
            <div className="flex items-center gap-1 text-[9px] text-white/40 font-black font-mono uppercase tracking-wider">
              <MapPin size={10} className="text-hud-teal" />
              {item.address.split(',')[0]}
            </div>
          )}
          <div className="flex items-center gap-1 bg-hud-teal/10 px-1.5 py-0.5 rounded-sm border border-hud-teal/20">
            <span className="text-[8px] font-black text-hud-teal uppercase tracking-tighter font-mono">{walkTime} MIN_WALK</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {onBook && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onBook(item);
              }}
              className="text-[9px] font-black text-white/30 hover:text-white uppercase tracking-[0.2em] px-2 py-1 transition-colors font-mono"
            >
              BOOK
            </button>
          )}
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onShareEvent(item);
            }}
            className="p-2 text-white/20 hover:text-hud-yellow transition-colors"
            title="SHARE_EVENT"
          >
            <Share2 size={14} />
          </button>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDirections(item);
            }}
            className="flex items-center gap-2 bg-hud-yellow text-hud-dark px-6 py-2 rounded-sm text-[12px] font-black uppercase tracking-[0.15em] hover:bg-white transition-all font-mono shadow-[0_0_20px_rgba(255,224,26,0.3)] active:scale-95"
          >
            GO <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
