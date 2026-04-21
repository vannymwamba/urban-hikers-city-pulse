import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MapPin, Share2, ArrowRight, Clock, Heart } from 'lucide-react';
import { format } from 'date-fns';
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
  onConfirm?: (id: string) => void;
  onShareEvent: (broadcast: Broadcast) => void;
  onManage?: (broadcast: Broadcast) => void;
  partner: Partner | null;
  sponsor?: Sponsor | null;
  variant?: 'hero' | 'peek';
  canManage?: boolean;
}

export const BroadcastCard: React.FC<BroadcastCardProps> = ({
  item,
  idx,
  currentNode,
  onSelect,
  onConfirm,
  onShareEvent,
  onManage,
  partner,
  variant = 'peek',
  canManage = false
}) => {
  const [progress, setProgress] = useState(100);
  const [showBooking, setShowBooking] = useState(false);
  const [spots, setSpots] = useState(1);
  const isFlashDeal = item.type === BroadcastType.FLASH_DEAL;
  const isWalkingEvent = item.type === BroadcastType.WALKING_EVENT;
  const isAllNodes = item.scope === 'all_nodes';
  
  const distance = currentNode ? getDistance(
    currentNode.latitude,
    currentNode.longitude,
    item.latitude || 0,
    item.longitude || 0
  ) : 0;
  const distanceMiles = (distance / 1609.34).toFixed(1);
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

  const cardHeight = variant === 'hero' ? 'h-[300px]' : 'h-[240px]';
  const cardWidth = variant === 'hero' ? 'w-full' : 'w-[85vw] max-w-[340px]';

  const handleCTA = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isWalkingEvent) {
      if (item.booking_url) {
        window.open(item.booking_url, '_blank');
        return;
      }
      setShowBooking(true); // open inline sheet instead of Stripe
      return;
    }
    if (item.payment_type === 'tip_jar' && item.tip_url) {
      window.open(item.tip_url, '_blank');
      return;
    }
    onSelect(item);
  };

  const openMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    const lat = item.latitude;
    const lng = item.longitude;
    const address = item.address;
    const destination = lat && lng ? `${lat},${lng}` : encodeURIComponent(address || 'Cincinnati, OH');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
  };

  const startTimeFormatted = item.startsAt || item.starts_at 
    ? format(new Date(item.startsAt || item.starts_at || 0), 'h:mm a')
    : '7:00 PM';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.05 }}
        onClick={() => onSelect(item)}
        className={`${cardWidth} ${cardHeight} relative rounded-[32px] overflow-hidden flex-shrink-0 cursor-pointer snap-start shadow-xl group`}
      >
        <img 
          src={item.cover_url || item.imageUrl || `https://picsum.photos/seed/${item.type}/800/500`}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/20 to-transparent" />
        
        {/* Top Header */}
        <div className="absolute top-5 left-5 right-5 flex items-start justify-between z-10 pointer-events-none">
          {/* Status Pill - Top Left */}
          <div className="pointer-events-auto">
            <div className={`px-5 py-2.5 rounded-full flex items-center gap-2.5 backdrop-blur-xl shadow-2xl ${statusTag.bg || 'bg-uh-magenta'} border border-white/20 scale-100 active:scale-95 transition-transform`}>
              <div className={`w-2 h-2 rounded-full ${getDotColor(item) || 'bg-white'} animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]`} />
              <span className="text-[11px] font-black tracking-[0.15em] uppercase text-white font-mono leading-none">
                {statusTag.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 pointer-events-auto">
            {/* Share FAB */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onShareEvent(item);
              }}
              className="w-11 h-11 bg-black/50 backdrop-blur-xl rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-uh-gray-800 transition-all shadow-2xl active:scale-90"
            >
              <Share2 size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Content Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col justify-end gap-2">
          <div className="mb-2 relative z-10">
             {isWalkingEvent && partner && (
               <span className="text-uh-yellow text-[10px] font-black tracking-[0.2em] uppercase font-mono block mb-1 drop-shadow-md">
                 Organizer: {partner.name}
               </span>
             )}
             <h3 className="text-white text-xl font-black uppercase tracking-tight leading-snug drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] max-w-[95%]">
              {item.title}
            </h3>
            
            {/* Thematic Accent Line & Progress */}
            <div className="flex flex-col gap-2 mt-2">
              <div className="w-16 h-1 bg-uh-yellow shadow-[0_0_8px_rgba(255,224,26,0.6)]" />
              
              {isFlashDeal && (
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                  <motion.div 
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                    className={`h-full ${progress < 20 ? 'bg-uh-magenta shadow-[0_0_8px_rgba(255,60,111,0.5)]' : 'bg-uh-yellow'}`}
                  />
                </div>
              )}

              {item.type === BroadcastType.MURAL && item.artist && (
                <span className="text-uh-gray-300 text-[10px] font-black uppercase tracking-[0.15em] mt-1 drop-shadow-lg">{item.artist}</span>
              )}
            </div>
          </div>

          <div className="flex items-end justify-between gap-4 relative z-10 w-full">
             {/* Location Capsule - Clickable to Maps */}
             <button 
              onClick={openMaps}
              className="group/loc flex items-center gap-2.5 px-4 py-2.5 bg-black/90 backdrop-blur-2xl rounded-full border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex-1 overflow-hidden hover:bg-uh-gray-800 active:scale-[0.98] transition-all"
             >
                <div className="w-6 h-6 rounded-full bg-uh-yellow flex items-center justify-center shrink-0 group-hover/loc:scale-110 transition-transform shadow-lg">
                  <MapPin size={12} className="text-uh-black fill-uh-black" strokeWidth={3} />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-black text-white uppercase tracking-tight truncate">
                    {item.venue || item.address?.split(',')[0]?.trim() || 'Nearby'}
                  </span>
                  <span className="text-[10px] font-black text-uh-yellow shrink-0">
                    · {distanceMiles} mi · {walkTime} min
                  </span>
                </div>
            </button>
            
            {/* Unified CTA Circle */}
            <button 
              onClick={handleCTA}
              className="w-12 h-12 bg-uh-yellow text-uh-black rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(255,224,26,0.3)] hover:scale-110 active:scale-90 transition-all shrink-0 group/cta"
            >
              {isWalkingEvent ? (
                <span className="text-[10px] font-black uppercase tracking-tight">Book</span>
              ) : (
                <ArrowRight size={20} strokeWidth={3} className="group-hover/cta:translate-x-1 transition-transform" />
              )}
            </button>
          </div>

          {isWalkingEvent && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-center gap-2">
              <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 10c0-3.31 2.69-6 6-6M7 10c0-1.65 1.35-3 3-3"
                  stroke="#FFE01A"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="10" cy="10" r="1.8" fill="#FFE01A"/>
              </svg>
              <span className="text-[8px] text-white/30 uppercase tracking-[0.14em] font-mono">Tap node at start to check in</span>
            </div>
          )}
        </div>
      </motion.div>


    {showBooking && (
      <div 
        onClick={() => setShowBooking(false)}
        style={{position:'fixed',inset:0,background:'rgba(0,0,0,.9)',zIndex:3000,display:'flex',alignItems:'flex-end'}}
        className="backdrop-blur-sm"
      >
        <div onClick={e => e.stopPropagation()} style={{background:'#0a0a0a',borderTop:'1px solid #222',width:'100%',padding:'40px 40px 60px',display:'flex',flexDirection:'column',gap:'32px'}} className="font-mono">
          
          <div className="flex flex-col gap-1">
            <div style={{fontSize:9,fontWeight:700,letterSpacing:'.2em',color:'#444',textTransform:'uppercase'}}>Walk_Protocol // {item.venue || item.address}</div>
            <div style={{fontSize:28,fontWeight:700,textTransform:'uppercase',letterSpacing:'-0.02em',lineHeight:1, color: '#fff'}} className="italic">{item.title}</div>
          </div>

          <div style={{display:'flex',gap:12}}>
            {[['Departs', item.departure_time || 'Pending'], ['Remaining', String(item.spots_remaining ?? '—')], ['Price', item.price ? `$${item.price}` : 'Free']].map(([l,v]) => (
              <div key={l} style={{flex:1,background:'#111',border: '1px solid #222',padding:'16px'}}>
                <div style={{fontSize:8,fontWeight:700,color:'#444',letterSpacing:'.15em',textTransform:'uppercase', marginBottom: '4px'}}>{l}</div>
                <div style={{fontSize:14,fontWeight:700,textTransform:'uppercase',color: l==='Price' && !item.price ? '#FFE01A' : '#fff'}}>{v}</div>
              </div>
            ))}
          </div>

          {item.description && (
            <div style={{fontSize:13,color:'#888',lineHeight:1.6, maxWidth: '600px'}}>{item.description}</div>
          )}

          {/* Spot selector — only show if price > 0 */}
          {(item.price ?? 0) > 0 && (
            <div style={{display:'flex',alignItems:'center',gap:16}}>
              <span style={{fontSize:10,fontWeight:700,color:'#444',textTransform:'uppercase',letterSpacing:'.1em'}}>Qty</span>
              <div style={{display:'flex',alignItems:'center',gap:12, background: '#111', border: '1px solid #222', padding: '4px'}}>
                <button onClick={() => setSpots(s => Math.max(1,s-1))} style={{width:32,height:32,background:'transparent',border:'none',color:'#fff',fontSize:18,cursor:'pointer'}}>−</button>
                <span style={{fontSize:16,fontWeight:700,minWidth:24,textAlign:'center', color: '#fff'}}>{spots}</span>
                <button onClick={() => setSpots(s => Math.min(4,s+1))} style={{width:32,height:32,background:'transparent',border:'none',color:'#fff',fontSize:18,cursor:'pointer'}}>+</button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <button
              onClick={async () => {
                if ((item.price ?? 0) === 0) {
                  // Free walk — confirm instantly, no Stripe
                  setShowBooking(false);
                  onConfirm?.(item.id);   // notify App
                  onSelect(item); // opens BroadcastModal with confirmed state
                  return;
                }
                // Paid — hit your existing Stripe endpoint
                const res = await fetch('/api/create-checkout-session', {
                  method:'POST',
                  headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({type:'walking_event_booking', broadcastId:item.id, title:item.title, price:(item.price??0)*spots})
                });
                const {url} = await res.json();
                if (url) window.location.href = url;
              }}
              style={{padding:'20px',background:'#FFE01A',color:'#0a0a0a',fontSize:12,fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',cursor:'pointer',width:'100%', border: 'none'}}
            >
              {(item.price ?? 0) === 0 ? 'Initialize_Spot — Free' : `Secure_Checkout · $${((item.price??0)*spots).toFixed(2)}`}
            </button>

            <div style={{fontSize:9,color:'#444',textAlign:'center', letterSpacing: '0.1em'}} className="uppercase">
              {(item.price ?? 0) === 0 ? 'Tap NFC Signal Node at meeting point to verify ID' : 'Encrypted Transaction · 0.5% Protocol Fee Included'}
            </div>
          </div>
        </div>
      </div>

    )}
    </>
  );
};
