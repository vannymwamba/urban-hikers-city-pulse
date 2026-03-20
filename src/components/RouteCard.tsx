import React from 'react';
import { motion } from 'motion/react';
import { Clock, Navigation, Zap, ShieldCheck, Mic2, MapPin, Flag, Trophy, Users } from 'lucide-react';
import { Route, Guide, Sponsor, Partner } from '../types';

interface RouteCardProps {
  route: Route;
  guide?: Guide | null;
  sponsor?: Sponsor | null;
  endPartner?: Partner | null;
  onStart: (route: Route) => void;
  onBook: (route: Route) => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({ 
  route, 
  guide, 
  sponsor, 
  endPartner,
  onStart, 
  onBook 
}) => {
  const isSponsored = route.type === 'sponsored';
  const isPremium = route.type === 'premium';
  
  const displayPrice = isSponsored ? route.discountedPrice : route.price;
  const isFree = displayPrice === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden mb-6 group shadow-2xl"
    >
      {/* Visual Header */}
      <div className="relative h-40 bg-zinc-900 overflow-hidden">
        {route.imageUrl ? (
          <img
            src={route.imageUrl}
            alt={route.title}
            className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
            <Navigation className="w-12 h-12 text-white/10" />
          </div>
        )}
        
        {/* Sponsor Banner */}
        {isSponsored && sponsor && (
          <div className="absolute top-4 left-4">
            <div className="bg-hud-yellow text-hud-dark px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg">
              <Trophy size={14} className="fill-hud-dark" />
              <span className="text-[10px] font-black tracking-[0.1em] uppercase font-mono">
                SPONSORED BY {sponsor.name}
              </span>
            </div>
          </div>
        )}

        {/* Price Tag */}
        <div className="absolute bottom-4 right-4">
          <div className="bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl">
            <span className={`text-lg font-black tracking-tighter font-mono ${isFree ? 'text-hud-green' : 'text-white'}`}>
              {isFree ? 'FREE' : `$${displayPrice?.toFixed(2)}`}
            </span>
            {!isFree && route.price > (displayPrice || 0) && (
              <span className="ml-2 text-[10px] text-white/40 line-through font-mono">
                ${route.price.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* Headline */}
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-white/5 border border-white/10 px-2 py-1 rounded text-[10px] font-black text-white/60 tracking-widest font-mono flex items-center gap-1.5">
            <Navigation size={10} />
            {route.durationMins} MIN
          </div>
          <h3 className="text-white font-black tracking-tighter text-xl uppercase font-mono truncate">
            {route.title}
          </h3>
        </div>

        {/* Ecosystem Connections */}
        <div className="space-y-3 mb-6">
          {/* Guide */}
          {guide && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                {guide.photoUrl ? (
                  <img src={guide.photoUrl} alt={guide.name} className="w-full h-full object-cover" />
                ) : (
                  <Mic2 size={14} className="text-white/40" />
                )}
              </div>
              <div>
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono leading-none mb-1">HOSTED BY</div>
                <div className="text-xs font-bold text-white font-sans italic">
                  Led by {guide.name} <span className="text-white/40 not-italic">({guide.title})</span>
                </div>
              </div>
            </div>
          )}

          {/* Start Location */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <MapPin size={14} className="text-hud-yellow" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono leading-none mb-1">STARTING LOCATION</div>
              <div className="text-xs font-bold text-white font-sans italic">
                Origin: {route.stops[0]?.name || 'Sector Hub'}
              </div>
            </div>
          </div>

          {/* Destination & Reward */}
          {endPartner && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <Flag size={14} className="text-hud-magenta" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono leading-none mb-1">PARTNER DESTINATION</div>
                <div className="text-xs font-bold text-white font-sans italic">
                  Ends at {endPartner.name} <span className="text-hud-green not-italic">({route.rewardText})</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-white/40 text-[11px] mb-6 line-clamp-2 leading-relaxed font-sans">
          {route.description}
        </p>

        {/* Action Button */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => isFree ? onStart(route) : onBook(route)}
            className={`w-full py-4 rounded-xl text-[12px] font-black tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-3 font-mono shadow-lg ${
              isFree 
                ? 'bg-hud-green text-hud-dark hover:shadow-[0_0_20px_rgba(29,158,117,0.4)]' 
                : 'bg-hud-yellow text-hud-dark hover:shadow-[0_0_20px_rgba(255,224,26,0.4)]'
            }`}
          >
            {isFree ? <Zap size={16} /> : <ShieldCheck size={16} />}
            {isFree ? 'SECURE FREE TICKET' : `BOOK NOW - $${displayPrice?.toFixed(2)}`}
          </button>
          
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-widest font-mono">
              <Users size={12} />
              {route.remainingSpots} SPOTS LEFT
            </div>
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest font-mono">
              CAPACITY: {route.capacity}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
