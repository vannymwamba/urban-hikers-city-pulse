import React from 'react';
import { Broadcast, BroadcastType } from '../types';
import { Zap, Mic, Music, Palette, Ticket, Calendar, Book, Truck, MapPin, ShoppingBag, Paintbrush } from 'lucide-react';

export const getIcon = (item: Broadcast) => {
  if (item.type === BroadcastType.LIVE_EVENT) return <Music size={18} className="text-[#FF3B30]" />;
  if (item.type === BroadcastType.FOOD_TRUCK) return <Truck size={18} className="text-[#F97316]" />;
  if (item.type === BroadcastType.WALKING_EVENT) return <MapPin size={18} className="text-[#10B981]" />;
  if (item.type === BroadcastType.FLASH_DEAL) return <Zap size={18} className="text-[#1A1A1A]" />;
  if (item.type === BroadcastType.MURAL) return <Palette size={18} className="text-[#8B5CF6]" />;
  if (item.type === BroadcastType.STREET_ART) return <Paintbrush size={18} className="text-[#8B5CF6]" />;
  if (item.type === BroadcastType.POP_UP) return <ShoppingBag size={18} className="text-[#0EA5E9]" />;
  return <Calendar size={18} className="text-[#185FA5]" />;
};

export const getIconBg = (item: Broadcast) => {
  if (item.type === BroadcastType.LIVE_EVENT) return 'bg-[#FF3B30]/10';
  if (item.type === BroadcastType.FOOD_TRUCK) return 'bg-[#F97316]/10';
  if (item.type === BroadcastType.WALKING_EVENT) return 'bg-[#10B981]/10';
  if (item.type === BroadcastType.FLASH_DEAL) return 'bg-[#FFE01A]';
  if (item.type === BroadcastType.MURAL) return 'bg-[#8B5CF6]/10';
  if (item.type === BroadcastType.STREET_ART) return 'bg-[#8B5CF6]/10';
  if (item.type === BroadcastType.POP_UP) return 'bg-[#0EA5E9]/10';
  return 'bg-[#F0EEE8]';
};

import { getTimeState, toMs } from './timeUtils';

export function getEventStatus(item: Broadcast) {
  // Walking events — always show booking status
  if (item.type === BroadcastType.WALKING_EVENT) {
    return { label: 'Booking Open', color: 'green' };
  }

  // Permanent types — no status pill
  if (
    item.type === BroadcastType.MURAL ||
    item.type === BroadcastType.STREET_ART
  ) {
    return null;
  }

  const state = getTimeState(item.starts_at, item.expires_at);

  switch (state) {
    case 'live':     return { label: 'Live Now',    color: 'red'    };
    case 'imminent': {
      const mins = Math.round(
        ((toMs(item.starts_at) || 0) - Date.now()) / 60000
      );
      return { label: `Starts in ${mins}m`, color: 'yellow' };
    }
    case 'upcoming': return { label: 'Upcoming',   color: 'purple' };
    case null:       return null;  // ended — hide card
    default:         return { label: 'Upcoming',   color: 'purple' };
  }
}

export const getCategoryTag = (item: Broadcast) => {
  const types: Record<string, { label: string; bg: string; text: string }> = {
    [BroadcastType.FLASH_DEAL]: {
      label: 'Flash Deal',
      bg: 'bg-[#FFE01A]',
      text: 'text-[#1A1A1A]',
    },
    [BroadcastType.LIVE_EVENT]: {
      label: 'Live Performance',
      bg: 'bg-[#FF3B30]',
      text: 'text-white',
    },
    [BroadcastType.FOOD_TRUCK]: {
      label: 'Food Truck',
      bg: 'bg-[#F97316]',
      text: 'text-white',
    },
    [BroadcastType.WALKING_EVENT]: {
      label: 'Guided Walk',
      bg: 'bg-[#10B981]',
      text: 'text-white',
    },
    [BroadcastType.POP_UP]: {
      label: 'Event',
      bg: 'bg-[#0EA5E9]',
      text: 'text-white',
    },
    [BroadcastType.CIVIC_EVENT]: {
      label: 'Civic Event',
      bg: 'bg-[#378ADD]',
      text: 'text-white',
    },
    [BroadcastType.MURAL]: {
      label: 'Mural',
      bg: 'bg-[#8B5CF6]',
      text: 'text-white',
    },
    [BroadcastType.STREET_ART]: {
      label: 'Street Art',
      bg: 'bg-[#8B5CF6]',
      text: 'text-white',
    },
  };
  return types[item.type] || { label: String(item.type).toUpperCase(), bg: 'bg-gray-500', text: 'text-white' };
};

export const getStatusTag = (item: Broadcast) => {
  const status = getEventStatus(item);
  if (!status) return { label: 'Expired', bg: 'bg-gray-700', text: 'text-white', color: 'gray' };

  const styles: Record<string, { bg: string, text: string }> = {
    red:    { bg: 'bg-[#FF3B30]', text: 'text-white' },
    yellow: { bg: 'bg-[#FFE01A]', text: 'text-[#0a0a0a]' },
    purple: { bg: 'bg-[#8B5CF6]', text: 'text-white' },
    green:  { bg: 'bg-[#10B981]', text: 'text-white' },
  };
  
  const style = styles[status.color] || { bg: 'bg-gray-500', text: 'text-white' };
  return { label: status.label, ...style, color: status.color };
};

export const getDotColor = (item: Broadcast) => {
  const status = getEventStatus(item);
  if (!status) return 'hidden';
  if (status.color === 'red') return 'bg-white shadow-[0_0_8px_#FFFFFF]';
  if (status.color === 'yellow') return 'bg-black shadow-[0_0_4px_rgba(0,0,0,0.2)]';
  return 'hidden';
};
