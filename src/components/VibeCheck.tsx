import React from 'react';
import { Vibe } from '../types';
import { motion } from 'motion/react';

interface VibeCheckProps {
  onReport: (vibe: Vibe) => void;
  isReporting: boolean;
}

export const VibeCheck: React.FC<VibeCheckProps> = ({ onReport, isReporting }) => {
  const options: { vibe: Vibe; color: string; label: string }[] = [
    { vibe: 'chill', color: 'bg-hud-green', label: 'CHILL' },
    { vibe: 'buzzing', color: 'bg-hud-yellow', label: 'BUZZING' },
    { vibe: 'packed', color: 'bg-hud-magenta', label: 'PACKED' },
  ];

  return (
    <div className="bg-hud-bg">
      <h3 className="text-[10px] font-bold mb-4 tracking-widest text-hud-green/40">CROWD_VIBE_REPORT</h3>
      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => (
          <motion.button
            key={opt.vibe}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isReporting}
            onClick={() => onReport(opt.vibe)}
            className={`flex flex-col items-center justify-center p-4 border border-hud-green/20 hover:border-hud-green hover:bg-hud-green/5 transition-all group ${isReporting ? 'opacity-50' : ''}`}
          >
            <div className={`w-2 h-2 mb-3 ${opt.color} group-hover:shadow-[0_0_8px_currentColor]`} />
            <span className="text-[10px] font-black tracking-widest">{opt.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
