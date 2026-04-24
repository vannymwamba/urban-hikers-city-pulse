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

const ARTWAVE_DONATION_URL = 'https://4agc.com/donation_pages/0785fa30-9065-400b-b54d-74458f2c9eb0';

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
  const isSponsored = item.is_sponsored === true;
  const isFlashDeal = item.type === BroadcastType.FLASH_DEAL;
  const isWalkingEvent = item.type === BroadcastType.WALKING_EVENT;
  const isMural =
    item.type === BroadcastType.MURAL ||
    item.type === BroadcastType.STREET_ART;
  const isAllNodes = item.scope === 'all_nodes';
  
  const distance = currentNode ? getDistance(
    currentNode.latitude,
    currentNode.longitude,
    item.latitude || 0,
    item.longitude || 0
  ) : 0;
  const distanceMiles = (distance / 1609.34).toFixed(1);
  const walkMinutes = Math.ceil(distance / 80);
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
        window.open(item.booking_url, '_blank', 'noopener,noreferrer');
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

  const locationLabel = (item.venue || item.address?.split(',')[0])?.trim() || 'Nearby';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.05 }}
        onClick={() => onSelect(item)}
        className={`${cardWidth} ${cardHeight} relative rounded-[32px] overflow-hidden flex-shrink-0 cursor-pointer snap-start shadow-2xl group bg-uh-black`}
        style={{ contain: 'layout paint' }}
      >
        {/* Background Layer: Illustration with reduced opacity */}
        <img 
          src={item.cover_url || item.imageUrl || `https://picsum.photos/seed/${item.type}/800/500`}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover opacity-65 mix-blend-normal transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
        
        {/* Top Header */}
        <div className="absolute top-6 left-6 right-6 flex items-start justify-between z-10 pointer-events-none">
          {/* Status Pill / Sponsor Logo Slot */}
          <div className="flex flex-row items-center gap-2 pointer-events-auto">
            {/* Sponsored badge — shows on any type */}
            {isSponsored && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm"
                style={{
                  background: 'rgba(255,255,255,0.92)',
                  border: '0.5px solid rgba(255,255,255,0.3)',
                }}
              >
                <svg
                  width="10" height="10" viewBox="0 0 24 24"
                  fill="#0a0a0a" stroke="none"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.86L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span
                  className="font-mono font-black uppercase"
                  style={{
                    fontSize: 8,
                    letterSpacing: '0.12em',
                    color: '#0a0a0a',
                  }}
                >
                  Sponsored
                </span>
              </div>
            )}

            {isWalkingEvent ? (
              item.sponsor_logo_url ? (
                <div className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-sm">
                  <img src={item.sponsor_logo_url} alt="Sponsored by" className="h-5 w-auto object-contain max-w-[80px]" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className={`px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-md shadow-lg ${statusTag.bg} border border-white/10`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${getDotColor(item)} animate-pulse`} />
                  <span className="text-[10px] font-black tracking-widest uppercase text-white font-mono">
                    {statusTag.label}
                  </span>
                </div>
              )
            ) : !isMural ? (
              <div className={`px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-md shadow-lg ${statusTag.bg} border border-white/10`}>
                <div className={`w-1.5 h-1.5 rounded-full ${getDotColor(item)} animate-pulse`} />
                <span className="text-[10px] font-black tracking-widest uppercase text-white font-mono">
                  {statusTag.label}
                </span>
              </div>
            ) : null}
          </div>


          <div className="flex items-center gap-4 pointer-events-auto">
            {isMural ? (
              <a
                href={ARTWAVE_DONATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Support this artist via ArtWave"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-sm border border-white/12 hover:bg-black/75 transition-all z-10"
              >
                <svg width="13" height="8" viewBox="0 0 24 14" fill="none">
                  <path d="M1 7 C3 3 5 3 7 7 C9 11 11 11 13 7 C15 3 17 3 19 7 C20 9 21 9 23 7" stroke="#FFE01A" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
                </svg>
                <span className="text-[8px] font-black tracking-widest uppercase text-white/70 font-mono">Donate</span>
              </a>
            ) : (
              /* Share FAB - Minimal */
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onShareEvent(item);
                }}
                className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-uh-black border border-black/5 hover:bg-white transition-all shadow-sm active:scale-90"
              >
                <Share2 size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        {/* Content Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col justify-end gap-2 overflow-hidden">
          {/* Meta Info */}
          <div className="mb-1 relative z-10">
             {isWalkingEvent && partner?.name && (
               <span className="text-white/45 text-[9px] font-black tracking-[0.16em] uppercase font-mono block mb-0.5">
                 {partner.name}
               </span>
             )}
             
             {/* Primary Focal Point: Title */}
             <h3 className="text-white text-lg font-black uppercase tracking-tight leading-tight line-clamp-2 break-words max-w-full">
              {item.title}
             </h3>

             {isSponsored && item.sponsor_name && (
               <span
                 className="font-mono font-black uppercase block"
                 style={{
                   fontSize: 8,
                   letterSpacing: '0.1em',
                   color: 'rgba(255,255,255,0.35)',
                   marginTop: 2,
                 }}
               >
                 Sponsored by {item.sponsor_name}
               </span>
             )}

             {isMural && item.artist && (
               <span className="text-white/45 text-[9px] font-black tracking-[0.12em] uppercase font-mono block mt-1">
                 {item.artist}
               </span>
             )}
            
            {/* Flash Deal Progress Bar - High Contrast Urban Style */}
            {isFlashDeal && (
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-3 max-w-[200px]">
                <motion.div 
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: "linear" }}
                  className="h-full bg-uh-yellow shadow-[0_0_8px_rgba(255,224,26,0.2)]"
                />
              </div>
            )}
          </div>

          {/* Location & CTA Row - Anchored */}
          <div className="flex items-center gap-2 mt-2 relative z-10 w-full">
             {/* Location Capsule */}
             <button 
              onClick={openMaps}
              className={`flex items-center gap-3 px-4 py-3 bg-uh-black rounded-2xl ${isWalkingEvent || isMural ? 'flex-1' : 'w-full'} overflow-hidden hover:bg-uh-black/90 active:scale-[0.98] transition-all shadow-lg border border-white/10`}
             >
                <div className="w-5 h-5 rounded-full bg-uh-yellow flex items-center justify-center shrink-0">
                  <MapPin size={10} className="text-uh-black fill-uh-black" strokeWidth={3} />
                </div>
                <span className="text-[11px] font-bold text-white uppercase tracking-tight truncate font-mono">
                  {locationLabel} · {distanceMiles} mi · {walkMinutes} min
                </span>
            </button>
            
            {/* CTA Buttons */}
            {isWalkingEvent && (
              <button 
                onClick={handleCTA}
                className="px-5 py-3 bg-uh-yellow text-uh-black rounded-2xl flex flex-col items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap min-w-[100px]"
              >
                <span className="text-[10px] font-black uppercase tracking-widest font-mono">Book Spot</span>
                <span className="text-[10px] font-black uppercase tracking-wide font-mono opacity-80">— {item.price === 0 || !item.price ? 'Free' : `$${item.price}`}</span>
              </button>
            )}

            {isMural && (
              <div className="flex gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(item);
                  }}
                  className="px-5 py-3 bg-uh-yellow text-uh-black rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
                >
                  VIEW
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareEvent(item);
                  }}
                  className="w-11 h-11 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center text-white border border-white/10 hover:bg-white/20 transition-all shadow-sm active:scale-90"
                >
                  <Share2 size={16} strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>
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
          </div>
        </div>
      </div>

    )}
    </>
  );
};
