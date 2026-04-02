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
  
  const isLivePerformance = item.type === 'live_performance';
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
      className={`bg-navy-mid mb-2 shadow-lg transition-all cursor-pointer group overflow-hidden relative border ${isLivePerformance ? 'border-[#FF00FF]/40 shadow-[0_0_15px_rgba(255,0,255,0.1)]' : 'border-white/5'} ${!status.isLive ? 'opacity-60' : ''}`}
      style={{
        borderRadius: '2px',
        borderLeft: isLivePerformance ? '4px solid #FF00FF' : (status.isLive ? '4px solid var(--color-live)' : '1px solid rgba(255,255,255,0.05)')
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
              <div className={`text-[14px] font-bold leading-none mb-1 tracking-tight font-sans ${isLivePerformance ? 'text-[#FF00FF]' : 'text-white'}`}>{item.title}</div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-medium text-white/50 font-sans">
                  {item.type === 'civic_mural' ? (item.venue || 'Unknown Artist') : (item.partner_id === 'admin' ? 'System Admin' : (partner?.name || item.partner_id || 'Local Partner'))}
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
        
        {/* NFC Claim Strip */}
        {item.type === 'flash_deal' && (
          <div className="mt-3 p-3 border border-hud-yellow/40 bg-hud-yellow/5 rounded-sm flex items-center justify-between group/nfc hover:bg-hud-yellow/10 transition-colors">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-hud-yellow font-sans">Tap NFC to claim · $2 off</span>
              <span className="text-[9px] text-white/40 font-sans">Show stamp at register · select items</span>
            </div>
            <div className="px-3 py-1 bg-hud-yellow text-hud-dark text-[10px] font-black uppercase tracking-widest rounded-full font-mono">
              Claim
            </div>
          </div>
        )}
        
        {/* Zone D: Deal Text */}
        <SponsorBadge partner={partner} zone="D" />
      </div>

      <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-t border-white/5">
        <div className="flex items-center gap-4">
          {item.address && (
            <div className="flex items-center gap-1 text-[9px] text-white/40 font-medium font-sans">
              <MapPin size={10} className="text-hud-teal" />
              {item.address.split(',')[0]}
            </div>
          )}
          <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded-sm border border-white/5">
            <span className="text-[8px] font-bold text-white/40 uppercase tracking-tighter font-mono">{walkTime} min walk</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {item.tip_url && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                window.open(item.tip_url!, '_blank');
              }}
              className="flex items-center gap-1 bg-green-500 text-black px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)] animate-pulse"
            >
              💸 Tip
            </button>
          )}
          
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
            title="Share Signal"
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
            Go <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
