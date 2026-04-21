import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface LandingPageProps {
  onLogin: () => void;
  onPartnerLogin?: () => void;
  onTapIntoPulse?: () => void;
  onCreatorIgnite?: () => void;
  userProfile?: UserProfile | null;
  onLoginSuccess?: (profile: UserProfile) => void;
  onOpenWallet?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onLogin, 
  onPartnerLogin, 
  onTapIntoPulse, 
  onCreatorIgnite, 
  userProfile 
}) => {
  const [tapsCount, setTapsCount] = useState(12);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseKey(prev => prev + 1);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-uh-black min-h-screen font-mono text-white flex flex-col selection:bg-uh-yellow selection:text-uh-black overflow-hidden">
      {/* Pulse Scan Overlay Waves */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden">
        {[0, 280, 560].map((delay, i) => (
          <motion.div
            key={`${pulseKey}-${i}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: [0, 5], 
              opacity: [0.3, 0.4, 0] 
            }}
            transition={{ 
              duration: 2.2, 
              delay: delay / 1000,
              ease: "easeOut"
            }}
            className="absolute aspect-square w-[400px] rounded-full border border-uh-yellow/30"
          />
        ))}
      </div>

      {/* LP-NAV */}
      <nav className="flex items-center justify-between px-10 py-5 border-b border-white/5 relative z-10 bg-uh-black/50 backdrop-blur-sm">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold tracking-[0.18em] text-uh-yellow uppercase italic">Local Pulse</span>
          <span className="text-[9px] tracking-[0.22em] text-[#555] uppercase">by Urban Hikers</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[10px] tracking-[0.15em] text-[#666] uppercase cursor-pointer hover:text-white transition-colors hidden sm:block">Nodes</span>
          <span className="text-[10px] tracking-[0.15em] text-[#666] uppercase cursor-pointer hover:text-white transition-colors hidden sm:block">Partners</span>
          <button 
            onClick={onLogin}
            className="text-[10px] tracking-[0.15em] text-white uppercase border border-[#444] px-[18px] py-2 bg-transparent cursor-pointer hover:border-uh-yellow hover:text-uh-yellow transition-all"
          >
            {userProfile ? 'Dashboard' : 'Login'}
          </button>
        </div>
      </nav>

      {/* LP-HERO */}
      <div className="flex-1 flex flex-col items-center justify-center px-10 py-20 text-center relative z-10">
        <div className="flex items-center gap-2 mb-12 border border-white/5 px-4 py-1.5 bg-[#111] relative">
          <motion.div 
            key={`dot-${pulseKey}`}
            animate={{ 
              backgroundColor: ["#FFE01A", "#FFFFFF", "#FFE01A"] 
            }}
            transition={{ 
              duration: 1.5,
              times: [0, 0.5, 1],
              repeat: 1,
              repeatType: "reverse"
            }}
            className="w-1.5 h-1.5 rounded-full bg-uh-yellow"
          />
          <span className="text-[9px] tracking-[0.2em] text-[#666] uppercase">OTR live signals</span>
          <span className="text-[9px] tracking-[0.1em] text-uh-yellow ml-1 italic">{tapsCount + 2} active</span>
          
          <AnimatePresence>
            <motion.div
              key={`status-text-${pulseKey}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 3, delay: 0.8 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold tracking-widest text-uh-yellow/60 uppercase italic"
            >
              Scanning city vibrancy...
            </motion.div>
          </AnimatePresence>

          <span className="text-[9px] tracking-[0.2em] text-[#666] uppercase ml-4 hidden sm:inline">nodes online</span>
          <span className="text-[9px] tracking-[0.1em] text-uh-yellow ml-1 hidden sm:inline italic">9</span>
        </div>

        <div className="text-[72px] font-bold tracking-tight leading-none mb-1.5 uppercase">
          Local<span className="text-uh-yellow">Pulse</span>
        </div>
        <div className="text-[11px] tracking-[0.22em] text-[#555] uppercase mb-14">
          Tap the city. Feel what's happening now.
        </div>

        <div className="flex flex-col items-center gap-5 mb-16">
          <div 
            onClick={onTapIntoPulse}
            className="relative w-[240px] h-[240px] flex items-center justify-center cursor-pointer group mb-10"
          >
            <motion.div 
              animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0.3, 0.7] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-[112px] h-[112px] rounded-full border-[1.5px] border-uh-yellow/70"
            />
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0.1, 0.35] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              className="absolute w-[164px] h-[164px] rounded-full border-[1.5px] border-uh-yellow/35"
            />
            <motion.div 
              animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.05, 0.15] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="absolute w-[224px] h-[224px] rounded-full border-[1.5px] border-uh-yellow/15"
            />
            <div className="w-20 h-20 rounded-full bg-uh-yellow flex items-center justify-center z-10 group-hover:scale-110 group-active:scale-95 transition-transform">
              <svg width="36" height="36" viewBox="0 0 20 20" fill="none">
                <path d="M4 10c0-3.31 2.69-6 6-6M7 10c0-1.65 1.35-3 3-3M10 10c0 0 0 0 0 0" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="10" cy="10" r="1.5" fill="#0a0a0a"/>
              </svg>
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.25em] text-[#555] uppercase">Tap to ignite</div>
            <div className="text-[10px] tracking-[0.1em] text-uh-yellow uppercase italic">Access city vibrancy in real time</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-20">
          <button 
            onClick={onTapIntoPulse}
            className="bg-uh-yellow text-uh-black font-bold text-[10px] tracking-[0.18em] uppercase px-7 py-3.5 border-none cursor-pointer hover:bg-[#f5d400] transition-colors"
          >
            Open departure board &darr;
          </button>
          <button 
            onClick={onCreatorIgnite}
            className="bg-transparent text-white font-normal text-[10px] tracking-[0.18em] uppercase px-7 py-3.5 border border-[#333] cursor-pointer hover:border-[#666] transition-colors"
          >
            Creator ignite
          </button>
          <button 
            onClick={onPartnerLogin}
            className="bg-transparent text-[#444] font-normal text-[10px] tracking-[0.18em] uppercase px-5 py-3.5 border-none cursor-pointer hover:text-[#888] transition-colors"
          >
            Partner login &rarr;
          </button>
        </div>
      </div>

      {/* LP-DEPARTURE */}
      <div className="border-t border-[#181818] px-10 py-6 grid grid-cols-1 md:grid-cols-3 gap-0">
        <div className="px-5 py-4 border-r border-[#181818] last:border-r-0">
          <div className="text-[8px] tracking-[0.2em] text-[#444] uppercase mb-1.5">Now broadcasting</div>
          <div className="text-[13px] text-white tracking-[0.05em] mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">50% off tacos — Gomez</div>
          <div className="text-[9px] text-uh-yellow tracking-[0.1em] uppercase italic">38 min remaining</div>
        </div>
        <div className="px-5 py-4 border-r border-[#181818] last:border-r-0">
          <div className="text-[8px] tracking-[0.2em] text-[#444] uppercase mb-1.5">Vibe check &middot; Vine St</div>
          <div className="text-[13px] text-white tracking-[0.05em] mb-0.5">Buzzing</div>
          <div className="text-[9px] text-uh-yellow tracking-[0.1em] uppercase italic">12 taps in last hour</div>
        </div>
        <div className="px-5 py-4 border-r border-[#181818] last:border-r-0">
          <div className="text-[8px] tracking-[0.2em] text-[#444] uppercase mb-1.5">Next signal</div>
          <div className="text-[13px] text-white tracking-[0.05em] mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap">Live jazz &middot; Woodward</div>
          <div className="text-[9px] text-[#444] tracking-[0.1em] uppercase italic">Starts in 22 min</div>
        </div>
      </div>
    </div>
  );
};

