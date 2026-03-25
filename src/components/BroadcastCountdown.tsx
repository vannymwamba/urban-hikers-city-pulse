import React, { useState, useEffect } from 'react';
import { Broadcast } from '../types';
import { motion } from 'motion/react';

interface BroadcastCountdownProps {
  broadcast: Broadcast;
}

export const BroadcastCountdown: React.FC<BroadcastCountdownProps> = ({ broadcast }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const start = new Date(broadcast.startsAt || broadcast.starts_at || 0);
  const end = new Date(broadcast.expiresAt || broadcast.expires_at || 0);
  const currentVibe = broadcast.currentVibe || broadcast.current_vibe;
  const isLive = now >= start && now < end;
  const isUpcoming = now < start;

  if (now >= end || isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  let label = "STARTS_IN";
  let colorClass = "text-white/40"; 
  let barColorClass = "bg-white/10";
  let timeRemaining = 0;
  let progress = 0;

  if (isLive) {
    timeRemaining = end.getTime() - now.getTime();
    const totalDuration = end.getTime() - start.getTime();
    progress = (timeRemaining / totalDuration) * 100;

    if (timeRemaining < 1000 * 60 * 15) { // < 15 mins
      label = "URGENT_EXPIRE";
      colorClass = "text-hud-coral";
      barColorClass = "bg-hud-coral";
    } else if (currentVibe === 'packed') {
      label = "LIVE_STATUS_PACKED";
      colorClass = "text-hud-magenta";
      barColorClass = "bg-hud-magenta";
    } else if (currentVibe === 'buzzing') {
      label = "LIVE_STATUS_BUZZING";
      colorClass = "text-hud-amber";
      barColorClass = "bg-hud-amber";
    } else {
      label = "LIVE_STATUS_CHILL";
      colorClass = "text-hud-teal";
      barColorClass = "bg-hud-teal";
    }
  } else if (isUpcoming) {
    const diffToStart = start.getTime() - now.getTime();
    label = "T_MINUS_START";
    colorClass = "text-white/40";
    barColorClass = "bg-white/10";
    timeRemaining = diffToStart;
    progress = Math.max(0, Math.min(100, (1 - (diffToStart / (24 * 60 * 60 * 1000))) * 100));
  }

  const hrs = Math.floor(timeRemaining / (1000 * 60 * 60));
  const mins = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  return (
    <div className="bg-black/20 p-3 border border-white/5 mt-2 mb-1">
      <div className="flex justify-between items-center mb-2">
        <div className={`text-[8px] font-black tracking-[0.2em] uppercase font-mono ${colorClass}`}>
          {label}
        </div>
        <div className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] font-mono">
          {isLive 
            ? `EXP: ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
            : `START: ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
          }
        </div>
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <div className="flex items-baseline gap-1">
          <span className={`text-[28px] font-black tabular-nums leading-none font-mono ${colorClass}`}>
            {hrs.toString().padStart(2, '0')}
          </span>
          <span className="text-[8px] font-black opacity-20 uppercase tracking-widest font-mono">H</span>
        </div>
        <span className={`text-[20px] font-black opacity-10 font-mono ${colorClass}`}>:</span>
        <div className="flex items-baseline gap-1">
          <span className={`text-[28px] font-black tabular-nums leading-none font-mono ${colorClass}`}>
            {mins.toString().padStart(2, '0')}
          </span>
          <span className="text-[8px] font-black opacity-20 uppercase tracking-widest font-mono">M</span>
        </div>
        <div className="ml-auto flex items-baseline gap-1 bg-white/5 px-2 py-1 rounded-sm border border-white/5">
          <span className={`text-[16px] font-black tabular-nums leading-none font-mono ${colorClass}`}>
            {secs.toString().padStart(2, '0')}
          </span>
          <span className="text-[7px] font-black opacity-30 uppercase tracking-widest font-mono">S</span>
        </div>
      </div>
      <div className="h-1 bg-white/5 overflow-hidden relative">
        <motion.div 
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "linear" }}
          className={`h-full ${barColorClass} shadow-[0_0_8px_currentColor]`}
          style={{ color: 'inherit' }}
        />
      </div>
    </div>
  );
};
