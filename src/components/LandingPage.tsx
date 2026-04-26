import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';

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
  const [liveSignals, setLiveSignals] = useState([
    { label: 'Flash deal · Gomez',     time: '38m left',     color: '#E24B4A', delay: 0    },
    { label: 'Live jazz · Woodward',   time: 'starts 22m',   color: '#FFE01A', delay: 0.3  },
    { label: 'TedWalk · OTR',          time: 'booking open', color: '#1D9E75', delay: 0.6  },
    { label: 'Family Storytime · CPL', time: '10:00 AM',     color: '#534AB7', delay: 0.9  },
  ]);

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
          snap.docs.map((d, i) => {
            const data = d.data()
            const colors = ['#E24B4A','#FFE01A','#1D9E75','#534AB7']
            return {
              label: `${data.title?.slice(0,20)}`,
              time:  data.starts_at && data.starts_at.toMillis() > Date.now() ? 'upcoming' : 'live',
              color: colors[i % colors.length],
              delay: i * 0.3,
            }
          })
        )
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

  return (
    <div className="bg-[#0a0a0a] min-h-screen font-mono text-white flex flex-col selection:bg-uh-yellow selection:text-uh-black overflow-hidden relative">
      {/* 1. GRID BACKGROUND */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundImage: `
            linear-gradient(rgba(255,224,26,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,224,26,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* FULL SCREEN WAVE OVERLAY */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden">
        {[0, 2, 4].map((delay, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.1, opacity: 0 }}
            animate={{ 
              scale: [0.1, 8], 
              opacity: [0, 0.15, 0] 
            }}
            transition={{ 
              duration: 10, 
              delay: delay,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{
              position: 'absolute',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              border: '0.5px solid rgba(255,224,26,0.2)',
            }}
          />
        ))}
      </div>

      {/* LP-NAV */}
      <nav className="flex items-center justify-between px-10 py-5 border-b border-white/5 relative z-20 bg-[#0a0a0a]/50 backdrop-blur-sm">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold tracking-[0.18em] text-uh-yellow uppercase italic">Local Pulse</span>
          <span className="text-[9px] tracking-[0.22em] text-[#555] uppercase">by Urban Hikers</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[10px] tracking-[0.15em] text-[#666] uppercase cursor-pointer hover:text-white transition-colors hidden sm:block">Nodes</span>
          <span className="text-[10px] tracking-[0.15em] text-[#666] uppercase cursor-pointer hover:text-white transition-colors hidden sm:block">Partners</span>
          <button 
            onClick={onLogin}
            style={{ borderRadius: 0 }}
            className="text-[10px] tracking-[0.15em] text-white uppercase border border-[#444] px-[18px] py-2 bg-transparent cursor-pointer hover:border-uh-yellow hover:text-uh-yellow transition-all"
          >
            {userProfile ? 'Dashboard' : 'Login'}
          </button>
        </div>
      </nav>

      {/* LP-HERO */}
      <div className="flex-1 flex flex-col items-center justify-center px-10 py-20 text-center relative z-10">
        {/* 2. STATUS BAR — tighten + add borders */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          border: '0.5px solid rgba(255,255,255,0.07)',
          padding: '6px 14px',
          background: 'rgba(255,255,255,0.03)',
          marginBottom: 24,
          position: 'relative'
        }}>
          <motion.div
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{ width: 5, height: 5, borderRadius: '50%',
                     background: '#FFE01A' }}
          />
          <span style={{ fontSize: 8, letterSpacing: '0.18em',
                         color: '#555', textTransform: 'uppercase' }}>
            OTR live signals
          </span>
          <span style={{ fontSize: 8, letterSpacing: '0.1em',
                         color: '#FFE01A', fontStyle: 'italic' }}>
            {tapsCount + 2} active
          </span>
          <span style={{ fontSize: 8, letterSpacing: '0.18em',
                         color: '#555', textTransform: 'uppercase',
                         marginLeft: 8, paddingLeft: 10,
                         borderLeft: '0.5px solid #1e1e1e' }}>
            nodes online
          </span>
          <span style={{ fontSize: 8, letterSpacing: '0.1em',
                         color: '#FFE01A', fontStyle: 'italic' }}>
            9
          </span>

          <AnimatePresence>
            <motion.div
              key={`status-text-${pulseKey}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 3, delay: 0.8 }}
              className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold tracking-[0.25em] text-uh-yellow/40 uppercase italic"
            >
              SCANNING_VIBRANCY
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="text-[72px] font-bold tracking-tight leading-none mb-1.5 uppercase">
          Local<span className="text-uh-yellow">Pulse</span>
        </div>
        <div className="text-[11px] tracking-[0.22em] text-[#555] uppercase mb-14">
          Tap the city. Feel what's happening now.
        </div>

        {/* 3. NFC PULSE — 4 rings, tighter core */}
        <div className="flex flex-col items-center gap-5 mb-16">
          <div 
            onClick={() => window.open('https://app.localpulses.com/tap/ALPHA_PLAZA_HUB', '_blank')}
            className="relative w-[240px] h-[240px] flex items-center justify-center cursor-pointer group mb-4"
          >
            {[
              { size: 80,  delay: 0,   opacity: 0.7  },
              { size: 116, delay: 0.3, opacity: 0.35 },
              { size: 156, delay: 0.6, opacity: 0.15 },
              { size: 198, delay: 0.9, opacity: 0.06 },
            ].map(({ size, delay, opacity }, i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [0.7, 1.05],
                  opacity: [opacity, 0],
                }}
                transition={{
                  duration: 2.4,
                  delay,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
                style={{
                  position: 'absolute',
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,224,26,0.7)',
                  borderColor: `rgba(255,224,26,${opacity})`,
                }}
              />
            ))}

            {/* Core button */}
            <div style={{
              width: 56, height: 56,
              borderRadius: '50%',
              background: '#FFE01A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              transition: 'transform 0.15s',
            }} className="group-hover:scale-110 group-active:scale-95">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                <path d="M4 10c0-3.31 2.69-6 6-6M7 10c0-1.65 1.35-3 3-3"
                  stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="10" cy="10" r="1.8" fill="#0a0a0a"/>
              </svg>
            </div>
          </div>
          <div className="mb-8">
            <div className="text-[10px] tracking-[0.25em] text-[#555] uppercase">Tap to ignite</div>
            <div className="text-[10px] tracking-[0.1em] text-uh-yellow uppercase italic">Access city vibrancy in real time</div>
          </div>

          {/* 4. ADD LIVE SIGNAL PILLS — below pulse */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 28,
            maxWidth: 600
          }}>
            {liveSignals.map((s, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                border: '0.5px solid #1a1a1a',
                background: '#111',
              }}>
                <motion.div
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: s.delay }}
                  style={{ width: 4, height: 4, borderRadius: '50%',
                           background: s.color, flexShrink: 0 }}
                />
                <span style={{ fontSize: 8, letterSpacing: '0.1em',
                               color: '#555', textTransform: 'uppercase' }}>
                  {s.label}
                </span>
                <span style={{ fontSize: 8, color: '#FFE01A',
                               letterSpacing: '0.06em' }}>
                  {s.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. CTA BUTTONS — sharper, no border-radius */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-20">
          <button 
            onClick={() => window.open('https://app.localpulses.com/tap/ALPHA_PLAZA_HUB', '_blank')}
            style={{ borderRadius: 0 }}
            className="bg-[#FFE01A] text-[#0a0a0a] font-bold text-[9px] tracking-[0.18em] uppercase px-7 py-3.5 border-none cursor-pointer hover:bg-[#f5d400] transition-colors"
          >
            Open departure board &darr;
          </button>
          <button 
            onClick={onCreatorIgnite}
            style={{ borderRadius: 0 }}
            className="bg-transparent text-white font-normal text-[9px] tracking-[0.18em] uppercase px-7 py-3.5 border border-[#333] cursor-pointer hover:border-[#666] transition-colors"
          >
            Creator ignite
          </button>
          <button 
            onClick={onPartnerLogin}
            style={{ borderRadius: 0 }}
            className="bg-transparent text-[#444] font-normal text-[9px] tracking-[0.18em] uppercase px-5 py-3.5 border-none cursor-pointer hover:text-[#888] transition-colors"
          >
            Partner login &rarr;
          </button>
        </div>
      </div>

      {/* 6. TICKER — make it feel like a live board */}
      <div className="border-t-[0.5px] border-[#111] bg-[#0a0a0a] px-10 py-0 grid grid-cols-1 md:grid-cols-3 gap-0 relative z-10">
        <div className="px-6 py-5 border-r-[0.5px] border-[#111] last:border-r-0">
          <div className="text-[7px] tracking-[0.18em] text-[#2a2a2a] uppercase mb-1.5">Now broadcasting</div>
          <div className="text-[12px] text-white tracking-[0.03em] mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis uppercase">50% off tacos — Gomez</div>
          <div className="text-[8px] text-uh-yellow tracking-[0.1em] uppercase italic">38 min remaining</div>
        </div>
        <div className="px-6 py-5 border-r-[0.5px] border-[#111] last:border-r-0">
          <div className="text-[7px] tracking-[0.18em] text-[#2a2a2a] uppercase mb-1.5">Vibe check &middot; Vine St</div>
          <div className="text-[12px] text-white tracking-[0.03em] mb-0.5 uppercase">Buzzing</div>
          <div className="text-[8px] text-uh-yellow tracking-[0.1em] uppercase italic">12 taps in last hour</div>
        </div>
        <div className="px-6 py-5 border-r-[0.5px] border-[#111] last:border-r-0">
          <div className="text-[7px] tracking-[0.18em] text-[#2a2a2a] uppercase mb-1.5">Next signal</div>
          <div className="text-[12px] text-white tracking-[0.03em] mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap uppercase">Live jazz &middot; Woodward</div>
          <div className="text-[8px] text-[#444] tracking-[0.1em] uppercase italic">Starts in 22 min</div>
        </div>
      </div>
    </div>
  );
};
