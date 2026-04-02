import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
  onPartnerLogin?: () => void;
  onTapIntoPulse?: () => void;
  onCreatorIgnite?: () => void;
  userProfile?: UserProfile | null;
  onLoginSuccess?: (profile: UserProfile) => void;
  onOpenWallet?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onPartnerLogin, onTapIntoPulse, onCreatorIgnite, userProfile }) => {
  const [tapsCount, setTapsCount] = useState(12482);

  // Increment taps counter every 3s
  useEffect(() => {
    const interval = setInterval(() => {
      setTapsCount(prev => prev + Math.floor(Math.random() * 3) + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const mockEvents = [
    { time: '18:30', name: 'LIVE JAZZ @ GHOST BABY', node: 'OTR-04', vibe: 'BUZZING', vibeColor: 'bg-uh-yellow text-uh-black' },
    { time: '19:00', name: 'ROOFTOP YOGA', node: 'PEND-02', vibe: 'CHILL', vibeColor: 'bg-white/10 text-white/60' },
    { time: '20:15', name: 'TECH MIXER', node: 'CBD-09', vibe: 'LIVE', vibeColor: 'bg-uh-magenta text-white' },
    { time: '21:00', name: 'VINYL NIGHT', node: 'NS-01', vibe: 'HYPE', vibeColor: 'bg-uh-yellow text-uh-black' },
  ];

  return (
    <div className="bg-uh-black text-white font-sans selection:bg-uh-yellow selection:text-uh-black overflow-x-hidden relative min-h-screen">
      {/* Rotated Side Labels */}
      <div className="fixed left-4 bottom-12 z-50 hidden lg:block">
        <div className="font-display text-[10px] text-white/20 tracking-[4px] uppercase vertical-text rotate-180" style={{ writingMode: 'vertical-rl' }}>
          ESTABLISHED_2024_CINCINNATI
        </div>
      </div>
      <div className="fixed right-4 bottom-12 z-50 hidden lg:block">
        <div className="font-display text-[10px] text-white/20 tracking-[4px] uppercase vertical-text" style={{ writingMode: 'vertical-rl' }}>
          HYPER_LOCAL_CIVIC_OS
        </div>
      </div>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-[100] px-6 md:px-12 h-20 flex items-center justify-between bg-uh-black/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-uh-yellow rounded-full flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="#0A0A0A"/>
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-xl tracking-[1px] text-white uppercase">Urban Hikers</span>
            <span className="font-sans text-[9px] text-uh-yellow/60 tracking-[2px] uppercase font-bold">Local Pulse</span>
          </div>
        </div>

        <button 
          onClick={onLogin}
          className="px-8 py-2 rounded-full border border-white/20 text-white text-[12px] font-bold tracking-[1px] hover:bg-white hover:text-uh-black transition-all uppercase"
        >
          {userProfile ? 'Dashboard' : 'Login'}
        </button>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative mb-8"
        >
          <h1 className="font-display text-7xl sm:text-9xl tracking-[4px] text-white mb-4 uppercase italic">Urban Hikers</h1>
          <div className="w-48 h-[2px] bg-uh-yellow mx-auto mb-8"></div>
          
          <div className="font-display text-2xl sm:text-4xl tracking-[1px] text-white mb-12 uppercase">
            Walking to Inspire / <span className="text-uh-yellow italic">Curiosity of Exploration</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onTapIntoPulse}
              className="w-full sm:w-auto px-10 py-4 bg-uh-yellow text-uh-black font-bold tracking-[1px] uppercase hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,224,26,0.3)]"
            >
              Tap into the Pulse
            </button>
            <button 
              onClick={onCreatorIgnite}
              className="w-full sm:w-auto px-10 py-4 bg-uh-magenta text-white font-bold tracking-[1px] uppercase hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,0,255,0.3)]"
            >
              Creator Ignite
            </button>
            <a href="#board" className="w-full sm:w-auto px-10 py-4 border border-white/20 text-white font-bold tracking-[1px] uppercase hover:bg-white/5 transition-all">
              ↓ Open Departure Board
            </a>
            <button 
              onClick={onPartnerLogin}
              className="w-full sm:w-auto px-10 py-4 text-white/40 font-bold tracking-[1px] uppercase hover:text-white transition-all"
            >
              Partner Login
            </button>
          </div>
        </motion.div>
      </section>

      {/* DEPARTURE BOARD */}
      <section id="board" className="px-6 md:px-12 py-24 border-t border-white/5 bg-uh-black/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <div className="relative">
              <div className="w-3 h-3 bg-uh-magenta rounded-full"></div>
              <div className="absolute inset-0 bg-uh-magenta rounded-full animate-ping opacity-75"></div>
            </div>
            <h2 className="font-display text-3xl tracking-[2px] text-white uppercase">Departure Board — Cincinnati</h2>
          </div>

          <div className="border border-white/10 rounded-lg overflow-hidden">
            {mockEvents.map((event, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_auto] md:grid-cols-[120px_1fr_200px_auto] gap-4 p-6 border-b border-white/5 hover:bg-white/[0.02] transition-colors items-center">
                <div className="font-display text-2xl text-uh-yellow italic">{event.time}</div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg tracking-tight uppercase">{event.name}</span>
                  <span className="text-[10px] text-white/40 tracking-[2px] uppercase font-mono">{event.node} SECTOR</span>
                </div>
                <div className="hidden md:block">
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-uh-yellow/20 w-3/4"></div>
                  </div>
                </div>
                <div className={`px-4 py-1 rounded text-[10px] font-black tracking-[2px] uppercase ${event.vibeColor}`}>
                  {event.vibe}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button className="shimmer-sweep group flex items-center gap-2 px-8 py-3 bg-uh-yellow text-uh-black font-bold tracking-[1px] uppercase transition-all">
              View Full Board <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="px-6 md:px-12 py-12 border-y border-white/5 bg-uh-black">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] text-white/40 tracking-[2px] uppercase mb-1">Active Nodes</span>
            <span className="font-display text-4xl text-white italic">42</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-white/40 tracking-[2px] uppercase mb-1">Partners</span>
            <span className="font-display text-4xl text-white italic">128</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-white/40 tracking-[2px] uppercase mb-1">Taps Today</span>
            <span className="font-display text-4xl text-uh-yellow italic">{tapsCount.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-white/40 tracking-[2px] uppercase mb-1">Network</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-uh-magenta rounded-full animate-pulse"></div>
              <span className="font-display text-4xl text-white italic">CIN-ON</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 md:px-12 py-20 bg-uh-black border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div>
            <div className="font-display text-3xl tracking-[2px] text-white mb-2 uppercase italic">Urban Hikers</div>
            <div className="font-sans text-[10px] text-uh-yellow tracking-[3px] uppercase font-bold">Local Pulse OS v2.4.0</div>
          </div>
          <div className="font-display text-[10px] text-white/20 tracking-[2px] uppercase text-right">
            &copy; 2024 Urban Hikers / Cincinnati_OH / All Rights Reserved
          </div>
        </div>
      </footer>
    </div>
  );
};
