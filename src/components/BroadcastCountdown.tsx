import React, { useState, useEffect } from 'react';
import { Broadcast, BroadcastType } from '../types';
import { motion } from 'motion/react';

interface BroadcastCountdownProps {
  broadcast: Broadcast;
  hideLabel?: boolean;
  hideProgress?: boolean;
}

export const BroadcastCountdown: React.FC<BroadcastCountdownProps> = ({ 
  broadcast, 
  hideLabel = false,
  hideProgress = false 
}) => {
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

  if (broadcast.type === BroadcastType.MURAL) {
    if (hideLabel && hideProgress) return null;
    return (
      <div className={`${hideLabel ? '' : 'bg-uh-gray-50 p-4 rounded-2xl border border-uh-gray-100 mt-2'}`}>
        {!hideLabel && (
          <div className="flex justify-between items-center">
            <div className="text-[10px] font-black tracking-widest font-mono text-uh-gray-400 uppercase">
              PERMANENT INSTALLATION
            </div>
            <div className="text-[10px] font-black text-uh-black font-mono uppercase tracking-widest">
              ALWAYS ON
            </div>
          </div>
        )}
        {!hideProgress && (
          <div className="h-1 bg-uh-yellow/20 overflow-hidden relative rounded-full mt-3">
            <div className="h-full w-full bg-uh-yellow rounded-full opacity-50" />
          </div>
        )}
      </div>
    );
  }

  if (now >= end || isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  let label = "STARTS_IN";
  let colorClass = "text-uh-gray-400"; 
  let barColorClass = "bg-uh-gray-100";
  let progressColorClass = "bg-uh-black";
  let timeRemaining = 0;
  let progress = 0;

  if (isLive) {
    timeRemaining = end.getTime() - now.getTime();
    const totalDuration = end.getTime() - start.getTime();
    progress = (timeRemaining / totalDuration) * 100;

    if (timeRemaining < 1000 * 60 * 15) { // < 15 mins
      label = "EXPIRES SOON";
      colorClass = "text-uh-magenta";
      progressColorClass = "bg-uh-magenta";
    } else {
      label = "LIVE NOW";
      colorClass = "text-uh-black";
      progressColorClass = "bg-uh-black";
    }
  } else if (isUpcoming) {
    const diffToStart = start.getTime() - now.getTime();
    label = "STARTS IN";
    colorClass = "text-uh-gray-400";
    progressColorClass = "bg-uh-gray-200";
    timeRemaining = diffToStart;
    progress = Math.max(0, Math.min(100, (1 - (diffToStart / (24 * 60 * 60 * 1000))) * 100));
  }

  const hrs = Math.floor(timeRemaining / (1000 * 60 * 60));
  const mins = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  const isUrgent = isLive && timeRemaining < 1000 * 60 * 5; // < 5 mins

  if (hideLabel && hideProgress) {
    return (
      <span className="tabular-nums">
        {hrs > 0 ? `${hrs}:` : ''}{mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
      </span>
    );
  }

  return (
    <div className={`${hideLabel ? '' : 'bg-uh-gray-50 p-4 rounded-2xl border border-uh-gray-100 mt-2'}`}>
      {!hideLabel && (
        <div className="flex justify-between items-center mb-3">
          <div className={`text-[10px] font-black tracking-widest font-mono uppercase ${isUrgent ? 'text-uh-magenta animate-pulse' : colorClass}`}>
            {isUrgent ? 'URGENT: EXPIRE' : label}
          </div>
          {!isUrgent && (
            <div className="text-[11px] font-black text-uh-black font-mono uppercase tracking-widest">
              {isLive 
                ? `${hrs > 0 ? `${hrs}H ` : ''}${mins} MIN`
                : `${hrs > 0 ? `${hrs}H ` : ''}${mins} MIN`
              }
            </div>
          )}
        </div>
      )}

      {isUrgent && !hideLabel ? (
        <div className="flex items-baseline gap-1">
          <div className="flex items-baseline gap-1">
            <span className="text-[24px] font-black tabular-nums leading-none font-mono text-uh-magenta">
              {mins.toString().padStart(2, '0')}
            </span>
            <span className="text-[8px] font-black opacity-40 uppercase tracking-widest font-mono text-uh-magenta">M</span>
          </div>
          <span className="text-[18px] font-black opacity-20 font-mono text-uh-magenta">:</span>
          <div className="flex items-baseline gap-1">
            <span className="text-[24px] font-black tabular-nums leading-none font-mono text-uh-magenta">
              {secs.toString().padStart(2, '0')}
            </span>
            <span className="text-[8px] font-black opacity-40 uppercase tracking-widest font-mono text-uh-magenta">S</span>
          </div>
        </div>
      ) : (
        !hideProgress && (
          <div className="h-1 bg-uh-gray-200 overflow-hidden relative rounded-full">
            <motion.div 
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "linear" }}
              className={`h-full ${progressColorClass} rounded-full`}
            />
          </div>
        )
      )}
      
      {hideLabel && (
        <div className="text-[11px] font-black font-mono uppercase tracking-widest tabular-nums">
          {hrs > 0 ? `${hrs}:` : ''}{mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
        </div>
      )}
    </div>
  );
};
