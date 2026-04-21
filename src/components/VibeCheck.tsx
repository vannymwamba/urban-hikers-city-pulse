import React from 'react';
import { Vibe } from '../types';
import { motion } from 'motion/react';
import { LocalPulseLoader } from './LocalPulseLoader';

interface VibeCheckProps {
  onReport: (vibe: Vibe) => void;
  isReporting: boolean;
}

export const VibeCheck: React.FC<VibeCheckProps> = ({ onReport, isReporting }) => {
  const options: { vibe: Vibe; color: string; label: string; accent: string }[] = [
    { vibe: 'chill', color: 'bg-uh-teal', label: 'CHILL', accent: 'text-uh-teal' },
    { vibe: 'buzzing', color: 'bg-uh-yellow', label: 'BUZZING', accent: 'text-uh-yellow' },
    { vibe: 'packed', color: 'bg-uh-magenta', label: 'PACKED', accent: 'text-uh-magenta' },
  ];

  return (
    <div className="bg-[#111] p-6 border border-white/5">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-3 bg-uh-yellow" />
        <h3 className="text-[9px] font-bold tracking-[0.2em] text-[#444] uppercase font-mono">Telemetry_Source_Input</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => (
          <motion.button
            key={opt.vibe}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isReporting}
            onClick={() => onReport(opt.vibe)}
            className={`flex flex-col items-center justify-center py-6 border border-white/5 hover:border-white/10 transition-all group relative overflow-hidden bg-black/40 rounded-sm ${isReporting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isReporting ? (
              <LocalPulseLoader variant="dots" />
            ) : (
              <>
                <div className={`w-1.5 h-1.5 mb-4 ${opt.color} transition-all`} />
                <span className={`text-[9px] font-bold tracking-[0.15em] relative z-10 font-mono ${opt.accent}`}>{opt.label}</span>
              </>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
};
