import React, { useRef, useState } from 'react';
import { Broadcast, Partner, Node, Sponsor, BroadcastType, UserProfile } from '../types';
import { BroadcastCard } from './BroadcastCard';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface FeedProps {
  broadcasts: Broadcast[];
  currentNode: Node | null;
  onSelect: (broadcast: Broadcast) => void;
  onShareEvent: (broadcast: Broadcast) => void;
  onManage?: (broadcast: Broadcast) => void;
  partnersMap: Record<string, Partner>;
  sponsorsMap: Record<string, Sponsor>;
  hideOtherSections?: boolean;
  userProfile?: UserProfile | null;
}

export const Feed: React.FC<FeedProps> = ({
  broadcasts,
  currentNode,
  onSelect,
  onShareEvent,
  onManage,
  partnersMap,
  hideOtherSections = false,
  userProfile = null
}) => {
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin' || userProfile?.email === 'vannymwamba@gmail.com';
  const isPartner = userProfile?.role === 'partner' || userProfile?.role === 'partner_admin' || userProfile?.role === 'partner_content_editor';

  const canManageBroadcast = (b: Broadcast) => {
    if (isAdmin) return true;
    if (isPartner && userProfile?.partner_id === b.partner_id) return true;
    return false;
  };

  const flashDeals = broadcasts.filter(b => b.type === BroadcastType.FLASH_DEAL);
  const foodTrucks = broadcasts.filter(b => b.type === BroadcastType.FOOD_TRUCK);
  const walkingEvents = broadcasts.filter(b => b.type === BroadcastType.WALKING_EVENT);
  const murals = broadcasts.filter(b => [BroadcastType.MURAL, 'civic_mural', BroadcastType.STREET_ART].includes(b.type as any));
  const events = broadcasts.filter(b => [BroadcastType.LIVE_EVENT, BroadcastType.POP_UP, 'event', 'conference_panel', BroadcastType.CIVIC_EVENT, 'live_performance'].includes(b.type as any));
  
  const flashDealsRef = useRef<HTMLDivElement>(null);
  const [activeFlashIndex, setActiveFlashIndex] = useState(0);

  const handleFlashScroll = () => {
    if (flashDealsRef.current) {
      const scrollLeft = flashDealsRef.current.scrollLeft;
      const width = flashDealsRef.current.offsetWidth;
      const index = Math.round(scrollLeft / width);
      setActiveFlashIndex(index);
    }
  };

  const SectionHeader = ({ title, count, status }: { title: string; count?: number; status?: string }) => (
    <div className="px-6 flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[12px] font-black tracking-[0.2em] text-uh-black uppercase font-mono">{title}</h2>
        {count !== undefined && (
          <span className="text-[10px] font-bold text-uh-gray-400 font-mono">[{count}]</span>
        )}
      </div>
      {status && (
        <span className="text-[10px] font-black text-uh-magenta uppercase tracking-widest font-mono animate-pulse">
          {status}
        </span>
      )}
    </div>
  );

  const MoreCard = ({ label }: { label: string }) => (
    <div className="flex-shrink-0 w-[85vw] max-w-[340px] h-[200px] rounded-[20px] border-2 border-dashed border-uh-gray-200 flex flex-col items-center justify-center gap-3 bg-uh-gray-50/50 snap-start">
      <div className="w-12 h-12 rounded-full bg-white border border-uh-gray-100 flex items-center justify-center shadow-sm">
        <motion.div
          animate={{ x: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <ArrowRight size={24} className="text-uh-black" />
        </motion.div>
      </div>
      <span className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest font-mono">{label}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-10 pb-20">
      {/* Flash Deals Hero Carousel */}
      {flashDeals.length > 0 && (
        <div className="flex flex-col">
          <SectionHeader title="FLASH_DEALS" status="LIVE_NOW" />
          
          <div 
            ref={flashDealsRef}
            onScroll={handleFlashScroll}
            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 gap-4"
          >
            {flashDeals.map((deal, idx) => (
              <BroadcastCard 
                key={deal.id}
                item={deal}
                idx={idx}
                currentNode={currentNode}
                onSelect={onSelect}
                onShareEvent={onShareEvent}
                onManage={onManage}
                partner={partnersMap[deal.partnerId || deal.partner_id || '']}
                variant="hero"
                canManage={canManageBroadcast(deal)}
              />
            ))}
          </div>

          {/* Snap Dots */}
          <div className="flex justify-center gap-1.5 mt-4">
            {flashDeals.map((_, i) => (
              <div 
                key={i} 
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeFlashIndex ? 'bg-uh-yellow w-4' : 'bg-uh-gray-200'}`} 
              />
            ))}
          </div>
        </div>
      )}

      {/* Food Trucks Carousel */}
      {foodTrucks.length > 0 && !hideOtherSections && (
        <div className="flex flex-col">
          <SectionHeader title="FOOD_TRUCKS" count={foodTrucks.length} status="LIVE_NOW" />
          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 gap-4">
            {foodTrucks.map((truck, idx) => (
              <BroadcastCard 
                key={truck.id}
                item={truck}
                idx={idx}
                currentNode={currentNode}
                onSelect={onSelect}
                onShareEvent={onShareEvent}
                onManage={onManage}
                partner={partnersMap[truck.partnerId || truck.partner_id || '']}
                variant="peek"
                canManage={canManageBroadcast(truck)}
              />
            ))}
            <MoreCard label="MORE_FOOD" />
          </div>
        </div>
      )}

      {/* Walking Events Carousel */}
      {walkingEvents.length > 0 && !hideOtherSections && (
        <div className="flex flex-col">
          <SectionHeader title="WALKING_EVENTS" count={walkingEvents.length} status="BOOKING_OPEN" />
          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 gap-4">
            {walkingEvents.map((walk, idx) => (
              <BroadcastCard 
                key={walk.id}
                item={walk}
                idx={idx}
                currentNode={currentNode}
                onSelect={onSelect}
                onShareEvent={onShareEvent}
                onManage={onManage}
                partner={partnersMap[walk.partnerId || walk.partner_id || '']}
                variant="peek"
                canManage={canManageBroadcast(walk)}
              />
            ))}
            <MoreCard label="MORE_WALKS" />
          </div>
        </div>
      )}

      {/* Events Carousel */}
      {events.length > 0 && !hideOtherSections && (
        <div className="flex flex-col">
          <SectionHeader title="LIVE_EVENTS" count={events.length} />
          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 gap-4">
            {events.map((event, idx) => (
              <BroadcastCard 
                key={event.id}
                item={event}
                idx={idx}
                currentNode={currentNode}
                onSelect={onSelect}
                onShareEvent={onShareEvent}
                onManage={onManage}
                partner={partnersMap[event.partnerId || event.partner_id || '']}
                variant="peek"
                canManage={canManageBroadcast(event)}
              />
            ))}
            <MoreCard label="MORE_EVENTS" />
          </div>
        </div>
      )}

      {/* Murals Carousel */}
      {murals.length > 0 && !hideOtherSections && (
        <div className="flex flex-col">
          <SectionHeader title="CIVIC_ART" count={murals.length} />
          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 gap-4">
            {murals.map((mural, idx) => (
              <BroadcastCard 
                key={mural.id}
                item={mural}
                idx={idx}
                currentNode={currentNode}
                onSelect={onSelect}
                onShareEvent={onShareEvent}
                onManage={onManage}
                partner={partnersMap[mural.partnerId || mural.partner_id || '']}
                variant="peek"
                canManage={canManageBroadcast(mural)}
              />
            ))}
            <MoreCard label="MORE_ART" />
          </div>
        </div>
      )}
    </div>
  );
};
