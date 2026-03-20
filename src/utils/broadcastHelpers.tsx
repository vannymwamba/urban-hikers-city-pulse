import React from 'react';
import { Broadcast, Vibe } from '../types';
import { Zap, Mic, Music, Palette, Ticket, Calendar } from 'lucide-react';

export const getIcon = (item: Broadcast) => {
  if (item.type === 'flash_deal') return <Zap size={18} className="text-[#BA7517]" />;
  if (item.type === 'conference_panel') return <Mic size={18} className="text-[#1A2B4A]" />;
  if (item.title.toLowerCase().includes('music') || item.title.toLowerCase().includes('jazz')) return <Music size={18} className="text-[#3B6D11]" />;
  if (item.title.toLowerCase().includes('art') || item.title.toLowerCase().includes('expo')) return <Palette size={18} className="text-[#534AB7]" />;
  if (item.type === 'event') return <Ticket size={18} className="text-[#185FA5]" />;
  return <Calendar size={18} className="text-[#185FA5]" />;
};

export const getIconBg = (item: Broadcast) => {
  if (item.type === 'flash_deal') return 'bg-[#FFF3CC]';
  if (item.type === 'conference_panel') return 'bg-[#E6F1FB]';
  if (item.title.toLowerCase().includes('music') || item.title.toLowerCase().includes('jazz')) return 'bg-[#EAF3DE]';
  if (item.title.toLowerCase().includes('art') || item.title.toLowerCase().includes('expo')) return 'bg-[#EEEDFE]';
  if (item.type === 'event') return 'bg-[#E6F1FB]';
  return 'bg-[#F0EEE8]';
};

export const getEventStatus = (item: Broadcast) => {
  const now = new Date();
  const start = new Date(item.startsAt);
  const end = new Date(item.expiresAt);

  if (now < start) {
    return { 
      isLive: false, 
      label: 'UPCOMING', 
      time: `STARTS AT ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}` 
    };
  }
  
  return { 
    isLive: true, 
    label: 'LIVE', 
    time: `ENDS AT ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}` 
  };
};

export const getBadgeLabel = (item: Broadcast) => {
  const now = new Date();
  const start = new Date(item.startsAt);
  const end = new Date(item.expiresAt);
  const isLive = now >= start && now < end;
  const vibe = item.currentVibe;

  if (!isLive) {
    const diffToStart = start.getTime() - now.getTime();
    const hrsToStart = diffToStart / (1000 * 60 * 60);
    if (hrsToStart < 2) return 'CHILL';
    return 'DORMANT';
  }

  if (vibe === 'packed') return 'LIVE';
  if (vibe === 'buzzing') return 'BUZZING';
  return 'CHILL';
};

export const getBadgeStyle = (item: Broadcast) => {
  const now = new Date();
  const start = new Date(item.startsAt);
  const end = new Date(item.expiresAt);
  const isLive = now >= start && now < end;
  const vibe = item.currentVibe;

  if (!isLive) {
    const diffToStart = start.getTime() - now.getTime();
    const hrsToStart = diffToStart / (1000 * 60 * 60);
    if (hrsToStart < 2) return 'bg-[#639922]/10 text-[#639922]'; // CHILL
    return 'bg-[#378ADD]/10 text-[#378ADD]'; // DORMANT
  }
  
  if (vibe === 'packed') return 'bg-[#E24B4A]/10 text-[#E24B4A]'; // LIVE
  if (vibe === 'buzzing') return 'bg-[#EF9F27]/10 text-[#EF9F27]'; // BUZZING
  return 'bg-[#639922]/10 text-[#639922]'; // CHILL
};

export const getDotColor = (item: Broadcast) => {
  const label = getBadgeLabel(item);
  const isLive = getEventStatus(item).isLive;
  
  let colorClasses = '';
  if (label === 'LIVE') colorClasses = 'bg-[#E24B4A] shadow-[0_0_8px_#E24B4A]';
  else if (label === 'BUZZING') colorClasses = 'bg-[#EF9F27]';
  else if (label === 'CHILL') colorClasses = 'bg-[#639922]';
  else colorClasses = 'bg-[#378ADD]';

  if (isLive) {
    return `${colorClasses} animate-pulse`;
  }
  return colorClasses;
};
