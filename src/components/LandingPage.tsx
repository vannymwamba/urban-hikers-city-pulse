import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { MapPin, ShieldAlert, Cpu, Thermometer, Wind, Zap, Terminal, Share2, Layers, Search, Globe, Lock, Unlock } from 'lucide-react';

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
  const [time, setTime] = useState(new Date());
  const [liveSignals, setLiveSignals] = useState([
    { label: 'DAMON LYNCH', status: 'LIVE', color: '#FFE01A' },
    { label: 'INTRO TO BLOCK PRINT', status: 'UPCOMING', color: '#666' },
    { label: 'AUGUST WILSON\'S THE', status: 'UPCOMING', color: '#666' },
  ]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'broadcasts'),
      where('expires_at', '>', Timestamp.now()),
      orderBy('expires_at'),
      limit(4)
    )
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        setLiveSignals(
          snap.docs.map((d) => {
            const data = d.data()
            const isLive = data.starts_at && data.starts_at.toMillis() < Date.now();
            return {
              label: `${data.title?.toUpperCase()}`,
              status: isLive ? 'LIVE' : 'UPCOMING',
              color: isLive ? '#FFE01A' : '#666',
            }
          })
        )
        setTapsCount(snap.size);
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseKey(prev => prev + 1);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  return (
    <div className="bg-[#050505] min-h-screen font-mono text-white flex flex-col selection:bg-uh-yellow selection:text-uh-black overflow-hidden relative">
      
      {/* NOISE & GRIT OVERLAY */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

      {/* GRADIENT MASKED MAP BACKGROUND BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_70%)] z-10" />
        <div className="absolute inset-0 grayscale contrast-125 brightness-50 mix-blend-screen"
             style={{ 
               backgroundImage: `url('https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?q=80&w=2576&auto=format&fit=crop')`,
               backgroundSize: 'cover',
               backgroundPosition: 'center'
             }} />
      </div>

      {/* VERTICAL SIDE SCANNER - LEFT */}
      <div className="fixed left-6 top-1/2 -translate-y-1/2 flex flex-col gap-8 z-20 hidden lg:flex">
         <div className="flex flex-col gap-1 items-center">
            <span className="text-[7px] font-black text-uh-yellow/30 uppercase vertical-text tracking-[0.4em]">CINCIKWHATI</span>
            <div className="w-[1px] h-32 bg-uh-yellow/10 relative">
               <motion.div 
                 animate={{ top: ['0%', '100%', '0%'] }}
                 transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                 className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-uh-yellow rounded-full shadow-[0_0_8px_#FFE01A]" 
               />
            </div>
            <span className="text-[7px] font-black text-uh-yellow/30 uppercase vertical-text tracking-[0.4em]">39.0991° N, 84.5120° W</span>
         </div>
      </div>

      {/* VERTICAL SIDE SCANNER - RIGHT */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-10 z-20">
         <div className="flex flex-col gap-2 items-center">
            <span className="text-[10px] font-black text-[#444] uppercase tracking-widest">{formatTime(time)}</span>
            <div className="flex flex-col items-center gap-0">
               <span className="text-3xl font-black text-uh-yellow tracking-tighter">72°</span>
               <Thermometer size={14} className="text-uh-yellow/40" />
            </div>
         </div>
         
         <div className="flex flex-col gap-4">
            {[1, 2, 3, 4, 5].map(i => (
               <div key={i} className={`w-3 h-[2px] ${i === 2 ? 'bg-uh-yellow shadow-[0_0_8px_#FFE01A]' : 'bg-[#222]'}`} />
            ))}
         </div>

         <div className="flex flex-col gap-8 text-[#444] font-black text-[8px] uppercase tracking-[0.3em] vertical-text">
            <span>Tap in.</span>
            <span>Tune in.</span>
            <span>Turn the city on.</span>
         </div>
      </div>

      {/* LP-NAV */}
      <nav className="flex items-center justify-between px-8 py-6 relative z-30">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-uh-yellow animate-pulse" />
            <span className="text-[14px] font-black tracking-[0.25em] text-uh-yellow uppercase">Local Pulse</span>
          </div>
          <span className="text-[8px] tracking-[0.4em] text-[#666] uppercase pl-3.5">By Urban Hikers</span>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-8 border-r border-[#222] pr-8">
            <span className="text-[9px] font-black tracking-[0.2em] text-[#666] uppercase cursor-pointer hover:text-uh-yellow transition-all flex items-center gap-2">
               <Layers size={12} strokeWidth={3} /> Nodes
            </span>
            <span className="text-[9px] font-black tracking-[0.2em] text-[#666] uppercase cursor-pointer hover:text-uh-yellow transition-all flex items-center gap-2">
               <Globe size={12} strokeWidth={3} /> Partners
            </span>
          </div>
          <button 
            onClick={onLogin}
            className="text-[9px] font-black tracking-[0.25em] text-uh-yellow uppercase border border-uh-yellow/30 px-6 py-2.5 bg-transparent cursor-pointer hover:bg-uh-yellow hover:text-[#0a0a0a] transition-all flex items-center gap-2 backdrop-blur-md"
          >
            {userProfile ? 'System Dashboard' : 'Login'}
          </button>
        </div>
      </nav>

      {/* LP-HERO */}
      <div className="flex-1 flex flex-col items-center justify-center px-10 py-10 relative z-20 text-center">
        
        {/* UPPER DATA HUD */}
        <div className="flex items-center gap-4 mb-2">
           <div className="h-px w-8 bg-uh-yellow/20" />
           <div className="flex items-center gap-2 px-4 py-1.5 border border-white/5 bg-white/5 backdrop-blur-xl">
             <div className="w-1 h-1 rounded-full bg-uh-yellow shadow-[0_0_5px_#FFE01A] animate-ping" />
             <span className="text-[8px] font-black tracking-[0.2em] text-[#666] uppercase">City Signals</span>
             <span className="text-[8px] font-black tracking-[0.2em] text-uh-yellow uppercase italic">{liveSignals.filter(s => s.status === 'LIVE').length + 12} Active</span>
           </div>
           <div className="h-px w-8 bg-uh-yellow/20" />
        </div>

        {/* MAIN DISTRESSED HEADLINE */}
        <div className="relative mb-6">
          <h1 className="text-[80px] md:text-[140px] font-black leading-none tracking-tighter uppercase relative z-10">
            Local <span className="text-uh-yellow relative inline-block">Pulse</span>
          </h1>
          {/* DISTRESSED OVERLAY TEXT */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 select-none blur-[2px]">
             <h1 className="text-[82px] md:text-[142px] font-black leading-none tracking-tighter uppercase text-uh-yellow mix-blend-overlay translate-x-1 translate-y-1">
               Local Pulse
             </h1>
          </div>
        </div>

        <div className="max-w-2xl mb-12">
          <p className="text-[14px] md:text-[18px] font-black tracking-widest text-[#888] uppercase leading-relaxed">
            See what's happening within 3 miles of you—right now. <br className="hidden md:block" />
            <span className="text-white">Live events. Real-time energy. No searching.</span>
          </p>
        </div>

        {/* CTA ACTIONS */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-20">
          <button 
            onClick={onTapIntoPulse}
            className="group relative bg-uh-yellow text-uh-black font-black text-[12px] tracking-[0.3em] uppercase px-10 py-5 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,224,26,0.3)]"
          >
            Explore What's Happening Now
          </button>
          
          <button 
            onClick={onLogin}
            className="group px-10 py-5 bg-transparent border border-[#333] hover:border-uh-yellow hover:bg-uh-yellow/5 transition-all"
          >
            <span className="text-[12px] font-black tracking-[0.3em] text-white uppercase group-hover:text-uh-yellow transition-all">View Live Map</span>
          </button>
        </div>

        {/* LIVE EVENT FEED */}
        <div className="w-full max-w-5xl mb-24">
          <div className="flex items-center justify-between mb-8 px-4">
             <span className="text-[10px] font-black text-uh-yellow tracking-[0.4em] uppercase">Live City Feed</span>
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-uh-yellow animate-ping" />
                <span className="text-[8px] font-black text-[#444] uppercase tracking-widest">Real-Time Sync Active</span>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
             {[
               { name: "Neon Nights Expo", loc: "Vine St", count: "142", status: "LIVE NOW", vibe: "BUZZING", color: "#FFE01A" },
               { name: "Jazz on the Terrace", loc: "Washington Park", count: "68", status: "HOT", vibe: "CHILL", color: "#FFE01A" },
               { name: "Street Art Jam", loc: "Main St", count: "215", status: "LIVE NOW", vibe: "PACKED", color: "#FFE01A" },
               { name: "Gallery Opening", loc: "Liberty St", count: "45", status: "UPCOMING", vibe: "CHILL", color: "#666" },
               { name: "Pop-up Market", loc: "Findlay", count: "89", status: "HOT", vibe: "BUZZING", color: "#FFE01A" }
             ].map((event, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-[#0a0a0a]/80 backdrop-blur-md border border-[#1a1a1a] p-5 text-left group hover:border-uh-yellow/40 transition-all cursor-pointer relative overflow-hidden"
                >
                   {/* Minimal Vibe Grid Background */}
                   <div className="absolute top-0 right-0 p-1 opacity-10">
                      <div className="grid grid-cols-3 gap-0.5">
                         {[...Array(9)].map((_, j) => <div key={j} className="w-0.5 h-0.5 bg-uh-yellow" />)}
                      </div>
                   </div>

                   <div className="flex justify-between items-start mb-4">
                      <div className={`text-[7px] font-black px-1.5 py-0.5 rounded-[2px] ${event.status === 'LIVE NOW' ? 'bg-uh-yellow text-uh-black' : 'border border-[#333] text-[#555]'}`}>
                         {event.status}
                      </div>
                      <span className="text-[8px] font-black text-uh-yellow tracking-tighter">{event.count} HERE</span>
                   </div>

                   <h3 className="text-[12px] font-black text-white uppercase mb-2 tracking-tight line-clamp-1 group-hover:text-uh-yellow transition-colors">
                      {event.name}
                   </h3>

                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                         <MapPin size={8} className="text-[#444]" />
                         <span className="text-[8px] font-black text-[#555] uppercase tracking-wider">{event.loc}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                         <Zap size={8} className="text-uh-yellow/40" />
                         <span className="text-[8px] font-black text-uh-yellow/60 uppercase tracking-widest">{event.vibe}</span>
                      </div>
                   </div>
                </motion.div>
             ))}
          </div>
        </div>

        {/* ANCHOR LINE */}
        <div className="w-full border-t border-b border-[#111] py-8 flex flex-col items-center gap-4">
          <p className="text-[10px] md:text-[12px] font-black tracking-[0.3em] text-[#666] uppercase max-w-3xl leading-relaxed">
            Local Pulse turns the city into a real-time, walkable dashboard. 
            <span className="text-white"> Tap any Pulse Cube. See what's alive. Walk toward it.</span>
          </p>
          <div className="flex items-center gap-4">
             <div className="h-px w-8 bg-[#222]" />
             <span className="text-[8px] font-black text-[#333] uppercase tracking-[0.4em]">
                Powered by Urban Hikers — Built from the streets of Cincinnati.
             </span>
             <div className="h-px w-8 bg-[#222]" />
          </div>
        </div>

      </div>

      {/* FOOTER DASHBOARD TICKER */}
      <footer className="border-t border-[#111] bg-[#050505] relative z-20 grid grid-cols-1 md:grid-cols-3">
        <div className="p-8 border-r border-[#111] flex flex-col gap-2">
           <div className="flex justify-between items-center">
              <span className="text-[8px] font-black text-[#333] uppercase tracking-[0.3em]">Now Broadcasting</span>
              <Terminal size={10} className="text-[#333]" />
           </div>
           <div className="flex flex-col">
              <span className="text-[13px] font-black text-white hover:text-uh-yellow cursor-pointer transition-colors uppercase">50% Off Tacos — Gomez</span>
              <span className="text-[9px] font-black text-uh-magenta italic uppercase tracking-widest mt-1">38 Min Remaining</span>
           </div>
        </div>

        <div className="p-8 border-r border-[#111] flex flex-col gap-2">
           <div className="flex justify-between items-center">
              <span className="text-[8px] font-black text-[#333] uppercase tracking-[0.3em]">Vibe Check · Vine St</span>
              <Zap size={10} className="text-[#333]" />
           </div>
           <div className="flex flex-col">
              <span className="text-[13px] font-black text-uh-yellow uppercase flex items-center gap-2">Buzzing <div className="w-1.5 h-1.5 bg-uh-yellow rounded-full animate-ping" /></span>
              <span className="text-[9px] font-black text-[#666] uppercase tracking-[0.15em] mt-1 italic">12 Taps in Last Hour</span>
           </div>
        </div>

        <div className="p-8 flex flex-col gap-2">
           <div className="flex justify-between items-center">
              <span className="text-[8px] font-black text-[#333] uppercase tracking-[0.3em]">Next Signal</span>
              <Search size={10} className="text-[#333]" />
           </div>
           <div className="flex flex-col">
              <span className="text-[13px] font-black text-white uppercase">Live Jazz · Woodward</span>
              <span className="text-[9px] font-black text-[#666] uppercase tracking-[0.15em] mt-1">Starts in 22 Min</span>
           </div>
        </div>
      </footer>
    </div>
  );
};

