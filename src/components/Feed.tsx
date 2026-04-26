import React, { useRef, useState } from 'react';
import { Broadcast, Partner, Node, Sponsor, BroadcastType, UserProfile } from '../types';
import { BroadcastCard } from './BroadcastCard';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

import { FlashRotation } from './FlashRotation';
import { FlashRotationInline } from './FlashRotationInline';

const ROTATION_THRESHOLD = 5;

interface FeedProps {
  broadcasts: Broadcast[];
  currentNode: Node | null;
  onSelect: (broadcast: Broadcast) => void;
  onConfirm?: (id: string) => void;
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
  onConfirm,
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

  const flashDeals = broadcasts.filter(b => b.type === BroadcastType.FLASH_DEAL || b.is_sponsored === true);
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

  const SectionHeader = ({ title, count, status, onSeeAll }: { title: string; count?: number; status?: string; onSeeAll?: () => void }) => (
    <div className="px-6 flex items-center justify-between mb-4">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-black tracking-[0.2em] text-uh-black uppercase">{title}</h2>
          {count !== undefined && (
            <span className="text-[11px] font-bold text-uh-gray-400">[{count}]</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {onSeeAll && count && count > ROTATION_THRESHOLD && (
          <button
            onClick={onSeeAll}
            className="text-[9px] font-black uppercase tracking-widest text-uh-gray-400 flex items-center gap-1 hover:text-uh-black transition-colors"
          >
            See all
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 10h10M12 7l3 3-3 3"/>
            </svg>
          </button>
        )}
        {status && (
          <span className={`text-[9px] font-black tracking-[0.14em] uppercase font-mono ${
            status === 'PUBLIC_MURALS' ? 'text-purple-400' :
            status.includes('LIVE') ? 'text-uh-magenta' : 
            status.includes('BOOK') ? 'text-uh-teal' : 'text-uh-yellow'
          }`}>
            {status.replace('_', ' ')}
          </span>
        )}
      </div>
    </div>
  );

  const MoreCard = ({ label }: { label: string }) => (
    <div className="flex-shrink-0 w-[240px] h-[220px] rounded-[32px] border-2 border-dashed border-uh-gray-200 flex flex-col items-center justify-center gap-4 bg-white/50 group cursor-pointer hover:border-uh-yellow transition-colors">
      <div className="w-12 h-12 rounded-full bg-uh-gray-50 flex items-center justify-center group-hover:bg-uh-yellow/10 transition-colors">
        <ArrowRight size={20} className="text-uh-gray-300 group-hover:text-uh-black transition-transform group-hover:translate-x-1" />
      </div>
      <span className="text-[11px] font-black text-uh-gray-400 uppercase tracking-widest">{label}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-10 py-6">
      <div className="flex flex-col">
        <SectionHeader 
          title="Flash Deals" 
          status="LIVE_NOW" 
          count={flashDeals.length}
          onSeeAll={() => console.log('See all flash deals')}
        />
        {/* Flash rotation — high priority campaigns */}
        <FlashRotation
          nodeId={currentNode?.id}
          intervalMs={3000}
          maxSlots={5}
          onCtaTap={(slot) => {
            console.log('Flash CTA tapped:', slot.campaign_title)
          }}
        />
        
        {/* Flash Deals Display Logic */}
        {flashDeals.length > 0 && (
          <div className="mt-4">
            {flashDeals.length <= ROTATION_THRESHOLD ? (
              <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 gap-4">
                {flashDeals.map((item, idx) => (
                  <BroadcastCard 
                    key={item.id}
                    item={item}
                    idx={idx}
                    currentNode={currentNode}
                    onSelect={onSelect}
                    onConfirm={onConfirm}
                    onShareEvent={onShareEvent}
                    onManage={onManage}
                    partner={partnersMap[item.partnerId || item.partner_id || '']}
                    variant="peek"
                    canManage={canManageBroadcast(item)}
                  />
                ))}
              </div>
            ) : (
              <div className="px-6">
                <FlashRotationInline 
                  broadcasts={flashDeals}
                  currentNode={currentNode}
                  intervalMs={3000}
                  onSelect={onSelect}
                  onConfirm={onConfirm}
                  onShareEvent={onShareEvent}
                  onManage={onManage}
                  partnersMap={partnersMap}
                  canManageBroadcast={canManageBroadcast}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Food Trucks Carousel */}
      {foodTrucks.length > 0 && !hideOtherSections && (
        <div className="flex flex-col">
          <SectionHeader title="Logistics Units" count={foodTrucks.length} status="SCANNING" />
          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 gap-4">
            {foodTrucks.map((truck, idx) => (
              <BroadcastCard 
                key={truck.id}
                item={truck}
                idx={idx}
                currentNode={currentNode}
                onSelect={onSelect}
                onConfirm={onConfirm}
                onShareEvent={onShareEvent}
                onManage={onManage}
                partner={partnersMap[truck.partnerId || truck.partner_id || '']}
                variant="peek"
                canManage={canManageBroadcast(truck)}
              />
            ))}
            <MoreCard label="EXPLORE_ALL" />
          </div>
        </div>
      )}

      {/* Walking Events Carousel */}
      {walkingEvents.length > 0 && !hideOtherSections && (
        <div className="flex flex-col">
          <SectionHeader title="Guided Walks" count={walkingEvents.length} status="BOOKING_OPEN" />
          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 gap-4">
            {walkingEvents.map((walk, idx) => (
              <BroadcastCard 
                key={walk.id}
                item={walk}
                idx={idx}
                currentNode={currentNode}
                onSelect={onSelect}
                onConfirm={onConfirm}
                onShareEvent={onShareEvent}
                onManage={onManage}
                partner={partnersMap[walk.partnerId || walk.partner_id || '']}
                variant="peek"
                canManage={canManageBroadcast(walk)}
              />
            ))}
            <MoreCard label="VIEW_SCHEDULE" />
          </div>
        </div>
      )}

      {/* Events Carousel */}
      {events.length > 0 && !hideOtherSections && (
        <div className="flex flex-col">
          <SectionHeader title="City Events" count={events.length} />
          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 gap-4">
            {events.map((event, idx) => (
              <BroadcastCard 
                key={event.id}
                item={event}
                idx={idx}
                currentNode={currentNode}
                onSelect={onSelect}
                onConfirm={onConfirm}
                onShareEvent={onShareEvent}
                onManage={onManage}
                partner={partnersMap[event.partnerId || event.partner_id || '']}
                variant="peek"
                canManage={canManageBroadcast(event)}
              />
            ))}
            <MoreCard label="SYSTEM_ARCHIVE" />
          </div>
        </div>
      )}

      {/* Murals Carousel */}
      {murals.length > 0 && !hideOtherSections && (
        <div className="flex flex-col">
          <SectionHeader title="Public Art" count={murals.length} status="PUBLIC_MURALS" />
          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 gap-4">
            {murals.map((mural, idx) => (
              <BroadcastCard 
                key={mural.id}
                item={mural}
                idx={idx}
                currentNode={currentNode}
                onSelect={onSelect}
                onConfirm={onConfirm}
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
