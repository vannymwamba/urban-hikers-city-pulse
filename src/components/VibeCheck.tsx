import React from 'react';
import { Vibe } from '../types';
import { motion } from 'motion/react';

interface VibeCheckProps {
  onReport: (vibe: Vibe) => void;
  isReporting: boolean;
}

export const VibeCheck: React.FC<VibeCheckProps> = ({ onReport, isReporting }) => {
  const options: { vibe: Vibe; color: string; label: string; accent: string }[] = [
    { vibe: 'chill', color: 'bg-hud-teal', label: 'CHILL', accent: 'text-hud-teal' },
    { vibe: 'buzzing', color: 'bg-hud-amber', label: 'BUZZING', accent: 'text-hud-amber' },
    { vibe: 'packed', color: 'bg-hud-coral', label: 'PACKED', accent: 'text-hud-coral' },
  ];

  return (
    <div className="bg-hud-bg p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-3 bg-hud-yellow" />
        <h3 className="text-[10px] font-black tracking-[0.2em] text-white/30 uppercase font-mono">CROWD_VIBE_REPORT_INPUT</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <motion.button
            key={opt.vibe}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isReporting}
            onClick={() => onReport(opt.vibe)}
            className={`flex flex-col items-center justify-center py-5 border border-white/10 hover:border-white/30 transition-all group relative overflow-hidden bg-black/20 rounded-sm ${isReporting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isReporting && (
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.5 }}
                className={`absolute inset-0 ${opt.color}/10`}
              />
            )}
            <div className={`w-1.5 h-1.5 mb-3 ${opt.color} group-hover:shadow-[0_0_12px_currentColor] relative z-10 transition-all`} />
            <span className={`text-[9px] font-black tracking-[0.15em] relative z-10 font-mono ${opt.accent}`}>{opt.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
