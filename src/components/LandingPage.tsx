import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { MapPin, Thermometer, Zap, Terminal, Layers, Globe, Search } from 'lucide-react';

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
  const [time, setTime] = useState(new Date());
  const [activeCount, setActiveCount] = useState(15);
  const [activeVectorMode, setActiveVectorMode] = useState<'nfc' | 'qr' | 'direct'>('nfc');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [liveSignals, setLiveSignals] = useState([
    { label: 'DAMON LYNCH', status: 'LIVE', color: '#F5E306' },
    { label: 'INTRO TO BLOCK PRINT', status: 'UPCOMING', color: '#8E8E85' },
    { label: 'AUGUST WILSON\'S THE', status: 'UPCOMING', color: '#8E8E85' },
  ]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Micro-motion: Fluctuate active count between 12 and 19
  useEffect(() => {
    const interval = setInterval(() => {
      const nextCount = Math.floor(Math.random() * (19 - 12 + 1)) + 12;
      setActiveCount(nextCount);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Firestore Live Signals
  useEffect(() => {
    const q = query(
      collection(db, 'broadcasts'),
      where('expires_at', '>', Timestamp.now()),
      orderBy('expires_at'),
      limit(4)
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        setLiveSignals(
          snap.docs.map((d) => {
            const data = d.data();
            const isLive = data.starts_at && data.starts_at.toMillis() < Date.now();
            return {
              label: `${data.title?.toUpperCase()}`,
              status: isLive ? 'LIVE' : 'UPCOMING',
              color: isLive ? '#F5E306' : '#8E8E85',
            };
          })
        );
      }
    });
    return () => unsub();
  }, []);

  // CANVAS DYNAMIC BACKGROUND SIMULATION
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let animationFrameId: number;

    // Node structure
    interface SignalNode {
      x: number;
      y: number;
      vx: number;
      vy: number;
      baseRadius: number;
      phase: number;
      twinkleSpeed: number;
      flare: number;
    }

    let nodes: SignalNode[] = [];
    const PROXIMITY_DIST = 95;

    // Mode-specific state
    let scanX = 0;
    let scanDirection = 1;
    let ripples: { x: number; y: number; radius: number; maxRadius: number; alpha: number }[] = [];
    let directBeams: { x1: number; y1: number; x2: number; y2: number; progress: number; alpha: number }[] = [];

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const initNodes = () => {
      nodes = [];
      const count = Math.max(25, Math.floor((width * height) / 12000));
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          baseRadius: Math.random() * 2 + 1.5,
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.02 + Math.random() * 0.03,
          flare: 0,
        });
      }
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initNodes();
    };

    window.addEventListener('resize', handleResize);
    initNodes();

    // Ripple Generator for NFC mode
    const rippleInterval = setInterval(() => {
      if (activeVectorMode === 'nfc' && nodes.length > 0 && !prefersReducedMotion) {
        const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
        ripples.push({
          x: randomNode.x,
          y: randomNode.y,
          radius: 5,
          maxRadius: 60 + Math.random() * 50,
          alpha: 0.8,
        });
      }
    }, 700);

    // Direct Beam Generator
    const beamInterval = setInterval(() => {
      if (activeVectorMode === 'direct' && nodes.length > 1 && !prefersReducedMotion) {
        const sourceIdx = Math.floor(Math.random() * nodes.length);
        const source = nodes[sourceIdx];

        let minDist = Infinity;
        let nearest: SignalNode | null = null;
        nodes.forEach((target, idx) => {
          if (idx !== sourceIdx) {
            const dist = Math.hypot(target.x - source.x, target.y - source.y);
            if (dist < minDist) {
              minDist = dist;
              nearest = target;
            }
          }
        });

        if (nearest && minDist < 300) {
          source.flare = 1.0;
          nearest.flare = 1.0;
          directBeams.push({
            x1: source.x,
            y1: source.y,
            x2: nearest.x,
            y2: nearest.y,
            progress: 0,
            alpha: 1.0,
          });
        }
      }
    }, 800);

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      const centerX = width / 2;
      const centerY = height * 0.45;
      const centerFalloffRadius = Math.min(width, height) * 0.4;

      // 1. Draw Nodes
      nodes.forEach(node => {
        if (!prefersReducedMotion) {
          node.x += node.vx;
          node.y += node.vy;

          if (node.x < 0 || node.x > width) node.vx *= -1;
          if (node.y < 0 || node.y > height) node.vy *= -1;

          node.phase += node.twinkleSpeed;
        }

        if (node.flare > 0) node.flare -= 0.02;

        const distToCenter = Math.hypot(node.x - centerX, node.y - centerY);
        const centerFactor = Math.min(1, Math.max(0.15, distToCenter / centerFalloffRadius));

        const baseAlpha = (0.3 + 0.3 * Math.sin(node.phase) + node.flare * 0.7) * centerFactor;

        ctx.beginPath();
        const r = node.baseRadius + node.flare * 3;
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 227, 6, ${baseAlpha.toFixed(3)})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 227, 6, ${(baseAlpha * 0.25).toFixed(3)})`;
        ctx.fill();
      });

      // 2. Proximity Lines
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dist = Math.hypot(n2.x - n1.x, n2.y - n1.y);

          if (dist < PROXIMITY_DIST) {
            const midX = (n1.x + n2.x) / 2;
            const midY = (n1.y + n2.y) / 2;
            const distToCenter = Math.hypot(midX - centerX, midY - centerY);
            const centerFactor = Math.min(1, Math.max(0.1, distToCenter / centerFalloffRadius));

            const lineAlpha = (1 - dist / PROXIMITY_DIST) * 0.22 * centerFactor;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(245, 227, 6, ${lineAlpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // 3. Vector Modes
      if (activeVectorMode === 'nfc') {
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rip = ripples[i];
          rip.radius += 1.2;
          rip.alpha -= 0.012;

          if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
            ripples.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(245, 227, 6, ${rip.alpha.toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else if (activeVectorMode === 'qr') {
        if (!prefersReducedMotion) {
          scanX += scanDirection * 4;
          if (scanX > width) { scanX = width; scanDirection = -1; }
          if (scanX < 0) { scanX = 0; scanDirection = 1; }
        }

        const scanGradient = ctx.createLinearGradient(scanX - 15, 0, scanX + 15, 0);
        scanGradient.addColorStop(0, 'rgba(245, 227, 6, 0)');
        scanGradient.addColorStop(0.5, 'rgba(245, 227, 6, 0.7)');
        scanGradient.addColorStop(1, 'rgba(245, 227, 6, 0)');

        ctx.fillStyle = scanGradient;
        ctx.fillRect(scanX - 15, 0, 30, height);

        nodes.forEach(node => {
          if (Math.abs(node.x - scanX) < 15) {
            node.flare = 0.9;
          }
        });
      } else if (activeVectorMode === 'direct') {
        for (let i = directBeams.length - 1; i >= 0; i--) {
          const beam = directBeams[i];
          beam.progress += 0.05;
          beam.alpha -= 0.02;

          if (beam.alpha <= 0 || beam.progress >= 1) {
            directBeams.splice(i, 1);
            continue;
          }

          const currentX = beam.x1 + (beam.x2 - beam.x1) * beam.progress;
          const currentY = beam.y1 + (beam.y2 - beam.y1) * beam.progress;

          ctx.beginPath();
          ctx.moveTo(beam.x1, beam.y1);
          ctx.lineTo(currentX, currentY);
          ctx.strokeStyle = `rgba(245, 227, 6, ${beam.alpha.toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(245, 227, 6, ${beam.alpha.toFixed(3)})`;
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(rippleInterval);
      clearInterval(beamInterval);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeVectorMode]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="bg-[#0A0A08] min-h-screen font-mono text-[#F7F7F2] uppercase flex flex-col justify-between relative overflow-x-hidden selection:bg-[#F5E306] selection:text-[#0A0A08]">
      
      {/* LAYER 0: Canvas Dynamic Signal Background */}
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0 pointer-events-none" />

      {/* LAYER 1: Radial Vignette Overlay */}
      <div 
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(10, 10, 8, 0.35) 0%, rgba(10, 10, 8, 0.75) 55%, rgba(10, 10, 8, 0.96) 100%)`
        }}
      />

      {/* LAYER 2: UI Content Container */}
      <div className="relative z-[2] w-full min-h-screen flex flex-col justify-between p-6 md:p-9 gap-8">
        
        {/* TOP NAV */}
        <nav className="flex items-center justify-between w-full">
          <div className="flex flex-col gap-0.5">
            <div className="text-[16px] font-black tracking-[-0.01em] text-white font-['Archivo'] leading-none">
              LOCAL <span className="text-[#F5E306]">PULSE</span>
            </div>
            <span className="text-[9px] font-medium tracking-[0.22em] text-[#8E8E85]">
              BY URBAN HIKERS
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#nodes" className="text-[11px] font-semibold tracking-[0.18em] text-[#8E8E85] hover:text-[#F5E306] transition-colors flex items-center gap-2">
              <span className="w-1.5 h-1.5 border border-[#8E8E85] inline-block" />
              NODES
            </a>
            <a href="#partners" className="text-[11px] font-semibold tracking-[0.18em] text-[#8E8E85] hover:text-[#F5E306] transition-colors flex items-center gap-2">
              <span className="w-1.5 h-1.5 border border-[#8E8E85] inline-block" />
              PARTNERS
            </a>
          </div>

          <button 
            onClick={onLogin}
            className="text-[10px] font-bold tracking-[0.22em] text-[#F5E306] bg-transparent border border-[#F5E306] px-5 py-2.5 cursor-pointer hover:bg-[#F5E306] hover:text-[#0A0A08] transition-all hover:shadow-[0_0_20px_rgba(245,227,6,0.4)]"
          >
            {userProfile ? 'SYSTEM DASHBOARD' : 'LOGIN'}
          </button>
        </nav>

        {/* CENTERED HERO */}
        <main className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto my-auto py-8">
          
          {/* Signal Pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 border border-[#232320] bg-[rgba(18,18,15,0.8)] backdrop-blur-md rounded-full mb-6 text-[10px] font-semibold tracking-[0.2em] text-[#8E8E85]">
            <span className="w-2 h-2 rounded-full bg-[#F5E306] shadow-[0_0_8px_#F5E306] animate-ping" />
            <span>CITY SIGNALS — <span className="text-[#F5E306] font-bold">{activeCount} ACTIVE</span></span>
          </div>

          {/* Stacked Hero Wordmark */}
          <div className="flex flex-col items-center font-['Archivo'] font-black leading-[0.86] tracking-[-0.01em] text-[clamp(66px,17vw,220px)] mb-6 select-none">
            <span className="text-[#F7F7F2] [text-shadow:0_0_35px_rgba(247,247,242,0.15)]">LOCAL</span>
            <span className="text-[#F5E306] [text-shadow:0_0_45px_rgba(245,227,6,0.5),0_0_12px_rgba(245,227,6,0.8)]">PULSE</span>
          </div>

          <p className="text-[clamp(12px,1.3vw,15px)] font-medium tracking-[0.18em] text-[#8E8E85] mb-2 max-w-2xl">
            SEE WHAT’S HAPPENING WITHIN 3 MILES OF YOU — RIGHT NOW.
          </p>

          <p className="text-[clamp(13px,1.4vw,16px)] font-bold tracking-[0.16em] text-white mb-8">
            LIVE EVENTS. REAL-TIME ENERGY. NO SEARCHING.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button 
              onClick={onTapIntoPulse}
              className="bg-[#F5E306] text-[#0A0A08] font-bold text-[11px] tracking-[0.2em] px-7 py-4 border border-[#F5E306] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(245,227,6,0.6)] transition-all shadow-[0_0_25px_rgba(245,227,6,0.35)]"
            >
              EXPLORE WHAT’S HAPPENING NOW
            </button>
            
            <button 
              onClick={onLogin}
              className="bg-transparent text-[#F7F7F2] font-semibold text-[11px] tracking-[0.2em] px-7 py-4 border border-[#232320] cursor-pointer hover:border-[#F5E306] hover:text-[#F5E306] hover:bg-[#F5E306]/5 transition-all"
            >
              VIEW LIVE MAP
            </button>
          </div>
        </main>

        {/* RIGHT HUD READOUT (Hidden < 820px) */}
        <aside className="fixed right-9 top-1/2 -translate-y-1/2 z-[2] hidden lg:flex flex-col items-end gap-1">
          <div className="text-[11px] font-semibold tracking-[0.2em] text-[#8E8E85]">
            {formatTime(time)}
          </div>
          <div className="font-['Archivo'] font-black text-[44px] text-[#F5E306] leading-none [text-shadow:0_0_20px_rgba(245,227,6,0.4)]">
            72°
          </div>
        </aside>

      </div>
    </div>
  );
};
