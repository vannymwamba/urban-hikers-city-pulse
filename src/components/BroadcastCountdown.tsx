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

  const start = new Date(broadcast.starts_at);
  const end = new Date(broadcast.expires_at);
  const isLive = now >= start && now < end;
  const isUpcoming = now < start;

  if (now >= end) return null;

  let label = "STARTS IN";
  let colorClass = "text-[#378ADD]"; // DORMANT Blue
  let barColorClass = "bg-[#378ADD]";
  let timeRemaining = 0;
  let progress = 0;

  if (isLive) {
    if (broadcast.current_vibe === 'packed') {
      label = "ENDS IN";
      colorClass = "text-[#E24B4A]"; // LIVE Red
      barColorClass = "bg-[#E24B4A]";
    } else if (broadcast.current_vibe === 'buzzing') {
      label = "DEAL EXPIRES IN";
      colorClass = "text-[#EF9F27]"; // BUZZING Amber
      barColorClass = "bg-[#EF9F27]";
    } else {
      label = "ENDS IN";
      colorClass = "text-[#639922]"; // CHILL Green
      barColorClass = "bg-[#639922]";
    }
    timeRemaining = end.getTime() - now.getTime();
    const totalDuration = end.getTime() - start.getTime();
    progress = (timeRemaining / totalDuration) * 100;
  } else if (isUpcoming) {
    const diffToStart = start.getTime() - now.getTime();
    const hrsToStart = diffToStart / (1000 * 60 * 60);
    
    if (hrsToStart < 2) { // Chill event (starts soon)
      label = "STARTS IN";
      colorClass = "text-[#639922]"; // CHILL Green
      barColorClass = "bg-[#639922]";
      // Progress fills from 0 to 100 as we approach start (last 2 hours)
      progress = Math.max(0, Math.min(100, (1 - (diffToStart / (2 * 60 * 60 * 1000))) * 100));
    } else { // Upcoming (far out)
      label = "STARTS IN";
      colorClass = "text-[#378ADD]"; // DORMANT Blue
      barColorClass = "bg-[#378ADD]";
      // Progress fills from 0 to 100 as we approach start (last 24 hours)
      progress = Math.max(0, Math.min(100, (1 - (diffToStart / (24 * 60 * 60 * 1000))) * 100));
    }
    timeRemaining = diffToStart;
  }

  const hrs = Math.floor(timeRemaining / (1000 * 60 * 60));
  const mins = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  return (
    <div className="bg-[#F8F7F4] p-4 rounded-xl border border-black/5 mt-3 mb-1">
      <div className="flex justify-between items-center mb-3">
        <div className={`text-[10px] font-black tracking-[0.15em] uppercase ${colorClass}`}>
          {label}
        </div>
        <div className="text-[10px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest">
          {isLive 
            ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
            : start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          }
        </div>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex flex-col items-center">
          <div className={`text-[22px] font-black tabular-nums leading-none ${colorClass}`}>
            {hrs.toString().padStart(2, '0')}
          </div>
          <div className="text-[9px] font-bold opacity-30 uppercase mt-1 tracking-widest">hr</div>
        </div>
        <div className={`text-xl font-black opacity-20 ${colorClass}`}>:</div>
        <div className="flex flex-col items-center">
          <div className={`text-[22px] font-black tabular-nums leading-none ${colorClass}`}>
            {mins.toString().padStart(2, '0')}
          </div>
          <div className="text-[9px] font-bold opacity-30 uppercase mt-1 tracking-widest">min</div>
        </div>
        <div className={`text-xl font-black opacity-20 ${colorClass}`}>:</div>
        <div className="flex flex-col items-center">
          <div className={`text-[22px] font-black tabular-nums leading-none ${colorClass}`}>
            {secs.toString().padStart(2, '0')}
          </div>
          <div className="text-[9px] font-bold opacity-30 uppercase mt-1 tracking-widest">sec</div>
        </div>
      </div>
      <div className="h-1.5 bg-black/5 rounded-full overflow-hidden relative">
        <motion.div 
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "linear" }}
          className={`h-full ${barColorClass}`}
        />
      </div>
    </div>
  );
};
