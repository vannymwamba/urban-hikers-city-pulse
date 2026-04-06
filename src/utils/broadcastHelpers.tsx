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

export const getEventStatus = (item: Broadcast) => {
  if (item.type === BroadcastType.MURAL) {
    return { isLive: true, label: 'ALWAYS_ON', time: 'PERMANENT', countdownText: 'PERMANENT' };
  }
  const now = new Date();
  const start = new Date(item.startsAt || item.starts_at || 0);
  const end = new Date(item.expiresAt || item.expires_at || 0);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { isLive: false, label: 'DORMANT', time: 'TIME_UNKNOWN', countdownText: '00:00:00' };
  }

  if (now < start) {
    return { 
      isLive: false, 
      label: 'UPCOMING', 
      time: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      countdownText: '00:00:00'
    };
  }
  
  if (now >= start && now < end) {
    let label = 'LIVE_NOW';
    if (item.type === BroadcastType.WALKING_EVENT) label = 'BOOKING_OPEN';
    if (item.type === BroadcastType.FLASH_DEAL) label = 'FLASH_DEAL';
    
    return { 
      isLive: true, 
      label, 
      time: end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      countdownText: '00:00:00'
    };
  }

  return { isLive: false, label: 'EXPIRED', time: 'EXPIRED', countdownText: '00:00:00' };
};

export const getCategoryTag = (item: Broadcast) => {
  const types: Record<string, { label: string, bg: string, text: string }> = {
    [BroadcastType.LIVE_EVENT]: { label: 'LIVE EVENT', bg: 'bg-[#FF3B30]', text: 'text-white' },
    [BroadcastType.FOOD_TRUCK]: { label: 'FOOD TRUCK', bg: 'bg-[#F97316]', text: 'text-white' },
    [BroadcastType.WALKING_EVENT]: { label: 'WALKING EVENT', bg: 'bg-[#10B981]', text: 'text-white' },
    [BroadcastType.FLASH_DEAL]: { label: 'FLASH DEAL', bg: 'bg-[#FFE01A]', text: 'text-[#1A1A1A]' },
    [BroadcastType.MURAL]: { label: 'MURAL', bg: 'bg-[#8B5CF6]', text: 'text-white' },
    [BroadcastType.STREET_ART]: { label: 'STREET ART', bg: 'bg-[#8B5CF6]', text: 'text-white' },
    [BroadcastType.POP_UP]: { label: 'POP-UP', bg: 'bg-[#0EA5E9]', text: 'text-white' },
  };
  return types[item.type] || { label: String(item.type).toUpperCase(), bg: 'bg-gray-500', text: 'text-white' };
};

export const getStatusTag = (item: Broadcast) => {
  const status = getEventStatus(item);
  const styles: Record<string, { bg: string, text: string }> = {
    LIVE_NOW: { bg: 'bg-[#FF3B30]', text: 'text-white' },
    UPCOMING: { bg: 'bg-[#7C3AED]', text: 'text-white' },
    ALWAYS_ON: { bg: 'bg-[#FFE01A]', text: 'text-[#1A1A1A]' },
    BOOKING_OPEN: { bg: 'bg-[#10B981]', text: 'text-white' },
    FLASH_DEAL: { bg: 'bg-[#FFE01A]', text: 'text-[#1A1A1A]' },
    DORMANT: { bg: 'bg-gray-500', text: 'text-white' },
    EXPIRED: { bg: 'bg-gray-700', text: 'text-white' },
  };

  // Type-specific overrides for LIVE_NOW
  if (status.label === 'LIVE_NOW') {
    if (item.type === BroadcastType.FOOD_TRUCK) styles.LIVE_NOW = { bg: 'bg-[#F97316]', text: 'text-white' };
    if (item.type === BroadcastType.POP_UP) styles.LIVE_NOW = { bg: 'bg-[#0EA5E9]', text: 'text-white' };
  }

  return { label: status.label, ...styles[status.label] };
};

export const getDotColor = (item: Broadcast) => {
  const status = getEventStatus(item);
  if (status.label === 'LIVE_NOW') return 'bg-white shadow-[0_0_8px_#FFFFFF] animate-pulse';
  return '';
};
