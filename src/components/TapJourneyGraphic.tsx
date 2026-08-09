import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, QrCode, Compass, Navigation, Zap, ShieldCheck, MapPin, Sparkles, Activity, Layers } from 'lucide-react';

interface TapJourneyGraphicProps {
  compact?: boolean;
}

export const TapJourneyGraphic: React.FC<TapJourneyGraphicProps> = ({ compact = false }) => {
  const [selectedVector, setSelectedVector] = useState<'nfc' | 'qr' | 'direct'>('nfc');
  const [activeStep, setActiveStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(true);

  // Nodes along the simulated journey path
  const journeyNodes = [
    { id: 'ALPHA_HUB', name: 'Alpha Plaza', x: 15, y: 55, type: 'CIVIC' },
    { id: 'VINE_ST', name: 'Vine St Hub', x: 40, y: 30, type: 'CULTURE' },
    { id: 'WASH_PARK', name: 'Washington Park', x: 68, y: 65, type: 'PARK' },
    { id: 'LIBERTY_HUB', name: 'Liberty Hub', x: 88, y: 40, type: 'ART' },
  ];

  // Auto step progression to show journey tracing
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % journeyNodes.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [isSimulating, journeyNodes.length]);

  return (
    <div className="w-full bg-[#080808] border border-white/10 rounded-2xl p-5 md:p-6 text-white relative overflow-hidden shadow-2xl font-mono">
      {/* Background Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,224,26,0.25) 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#FFE01A] animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FFE01A]">
              Dynamic Tap Vector & Journey Tracer
            </span>
          </div>
          <p className="text-[11px] font-sans text-white/60">
            Differentiating NFC proximity wave taps, QR laser scans, and Direct beacons along city trails.
          </p>
        </div>

        {/* Vector Toggle Buttons */}
        <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10 shrink-0">
          <button
            onClick={() => setSelectedVector('nfc')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedVector === 'nfc'
                ? 'bg-[#FFE01A] text-black shadow-[0_0_12px_rgba(255,224,26,0.4)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio size={12} />
            <span>NFC Wave</span>
          </button>

          <button
            onClick={() => setSelectedVector('qr')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedVector === 'qr'
                ? 'bg-[#10B981] text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <QrCode size={12} />
            <span>QR Laser</span>
          </button>

          <button
            onClick={() => setSelectedVector('direct')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedVector === 'direct'
                ? 'bg-[#06B6D4] text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Compass size={12} />
            <span>Direct</span>
          </button>
        </div>
      </div>

      {/* Main Graphic Arena: Split into Graphic Radar & Journey Node Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
        
        {/* Left Column: Tap Vector Visualiser (Radio wave vs Laser Scan vs Beacon Ring) */}
        <div className="lg:col-span-5 bg-black/80 border border-white/10 rounded-xl p-5 flex flex-col items-center justify-center relative min-h-[220px] overflow-hidden">
          {/* Vector Specific Animated Visual */}
          <AnimatePresence mode="wait">
            {selectedVector === 'nfc' && (
              <motion.div
                key="nfc-animation"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center relative w-full h-40"
              >
                {/* Concentric Electro Waves */}
                {[0, 1, 2, 3].map((ring) => (
                  <motion.div
                    key={ring}
                    className="absolute rounded-full border-2 border-[#FFE01A]"
                    style={{
                      width: 40 + ring * 35,
                      height: 40 + ring * 35,
                    }}
                    animate={{
                      scale: [1, 1.35, 1],
                      opacity: [0.9, 0.15, 0.9],
                      borderColor: ring % 2 === 0 ? '#FFE01A' : '#F59E0B',
                    }}
                    transition={{
                      duration: 2.2,
                      repeat: Infinity,
                      delay: ring * 0.4,
                      ease: 'easeInOut',
                    }}
                  />
                ))}

                {/* Central NFC Phone Tap Object */}
                <motion.div 
                  animate={{ y: [-4, 4, -4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="z-10 w-14 h-14 rounded-2xl bg-[#FFE01A] text-black flex flex-col items-center justify-center shadow-[0_0_25px_rgba(255,224,26,0.6)] border-2 border-white"
                >
                  <Radio size={22} className="animate-pulse" />
                  <span className="text-[7px] font-black uppercase tracking-tight mt-0.5">NFC_TAP</span>
                </motion.div>

                <div className="mt-4 z-10 bg-black/80 px-3 py-1 rounded border border-[#FFE01A]/40 text-center">
                  <span className="text-[9px] font-bold text-[#FFE01A] uppercase tracking-widest block">
                    ⚡ High-Confidence Hardware Contact
                  </span>
                  <span className="text-[8px] text-white/50 font-mono">Value Multiplier: 1.0x · Proximity Verified</span>
                </div>
              </motion.div>
            )}

            {selectedVector === 'qr' && (
              <motion.div
                key="qr-animation"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center relative w-full h-40"
              >
                {/* Matrix Laser Scan Box */}
                <div className="w-36 h-36 border-2 border-[#10B981]/60 rounded-xl relative overflow-hidden flex items-center justify-center bg-[#10B981]/5">
                  <QrCode size={64} className="text-[#10B981] opacity-40" />
                  
                  {/* Moving Green Laser Beam Line */}
                  <motion.div
                    className="absolute left-0 right-0 h-1 bg-[#10B981] shadow-[0_0_15px_#10B981]"
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                  />

                  {/* Scan Corners */}
                  <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-[#10B981]" />
                  <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-[#10B981]" />
                  <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-[#10B981]" />
                  <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-[#10B981]" />
                </div>

                <div className="mt-3 z-10 bg-black/80 px-3 py-1 rounded border border-[#10B981]/40 text-center">
                  <span className="text-[9px] font-bold text-[#10B981] uppercase tracking-widest block">
                    🎯 Optical Camera Alignment Scan
                  </span>
                  <span className="text-[8px] text-white/50 font-mono">Value Multiplier: 0.8x · Visual Match</span>
                </div>
              </motion.div>
            )}

            {selectedVector === 'direct' && (
              <motion.div
                key="direct-animation"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center relative w-full h-40"
              >
                {/* Beacon Target Rings */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full border border-[#06B6D4]"
                    style={{ width: 60 + i * 40, height: 60 + i * 40 }}
                    animate={{ rotate: i % 2 === 0 ? 360 : -360, scale: [0.95, 1.05, 0.95] }}
                    transition={{ duration: 6 + i * 2, repeat: Infinity, ease: 'linear' }}
                  />
                ))}

                <div className="w-12 h-12 rounded-full bg-[#06B6D4] text-black flex items-center justify-center shadow-[0_0_20px_#06B6D4] z-10">
                  <Navigation size={22} className="animate-spin" style={{ animationDuration: '8s' }} />
                </div>

                <div className="mt-4 z-10 bg-black/80 px-3 py-1 rounded border border-[#06B6D4]/40 text-center">
                  <span className="text-[9px] font-bold text-[#06B6D4] uppercase tracking-widest block">
                    🌐 Direct Link & Spatial Beacon
                  </span>
                  <span className="text-[8px] text-white/50 font-mono">Value Multiplier: 0.5x · Digital Entry</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Urban Journey Trail Canvas */}
        <div className="lg:col-span-7 bg-black/80 border border-white/10 rounded-xl p-5 relative overflow-hidden min-h-[220px] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50 flex items-center gap-1.5">
              <MapPin size={12} className="text-[#FFE01A]" />
              City Journey Trail Map (OTR Route)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-[#FFE01A] uppercase bg-[#FFE01A]/10 px-2 py-0.5 rounded border border-[#FFE01A]/20">
                ACTIVE STEP: {journeyNodes[activeStep].name}
              </span>
            </div>
          </div>

          {/* Interactive SVG Journey Map */}
          <div className="relative w-full h-36 my-2 bg-[#0c0c0c] border border-white/5 rounded-lg p-2">
            <svg className="w-full h-full overflow-visible">
              {/* Connected Route Paths */}
              <path
                d={`M 15% 55% L 40% 30% L 68% 65% L 88% 40%`}
                fill="none"
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="3"
                strokeDasharray="6 4"
              />

              {/* Active Animated Trail Line */}
              <motion.path
                d={`M 15% 55% L 40% 30% L 68% 65% L 88% 40%`}
                fill="none"
                stroke={selectedVector === 'nfc' ? '#FFE01A' : selectedVector === 'qr' ? '#10B981' : '#06B6D4'}
                strokeWidth="3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: (activeStep + 1) / journeyNodes.length }}
                transition={{ duration: 1, ease: 'easeInOut' }}
              />

              {/* Moving Particle Pulse along path */}
              <motion.circle
                r="6"
                fill={selectedVector === 'nfc' ? '#FFE01A' : selectedVector === 'qr' ? '#10B981' : '#06B6D4'}
                filter="drop-shadow(0px 0px 8px currentColor)"
                animate={{
                  cx: `${journeyNodes[activeStep].x}%`,
                  cy: `${journeyNodes[activeStep].y}%`,
                }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
              />

              {/* Journey Node Markers */}
              {journeyNodes.map((node, idx) => {
                const isVisited = idx <= activeStep;
                const isCurrent = idx === activeStep;

                return (
                  <g key={node.id} className="cursor-pointer" onClick={() => setActiveStep(idx)}>
                    {/* Pulsing Aura if current */}
                    {isCurrent && (
                      <motion.circle
                        cx={`${node.x}%`}
                        cy={`${node.y}%`}
                        r="14"
                        fill="none"
                        stroke={selectedVector === 'nfc' ? '#FFE01A' : selectedVector === 'qr' ? '#10B981' : '#06B6D4'}
                        strokeWidth="1.5"
                        animate={{ scale: [0.8, 1.4, 0.8], opacity: [0.8, 0.1, 0.8] }}
                        transition={{ duration: 1.8, repeat: Infinity }}
                      />
                    )}

                    {/* Node Dot */}
                    <circle
                      cx={`${node.x}%`}
                      cy={`${node.y}%`}
                      r={isCurrent ? "8" : "5"}
                      fill={isVisited ? (selectedVector === 'nfc' ? '#FFE01A' : selectedVector === 'qr' ? '#10B981' : '#06B6D4') : '#333'}
                      stroke="#000"
                      strokeWidth="2"
                    />

                    {/* Node Label */}
                    <text
                      x={`${node.x}%`}
                      y={`${node.y + (node.y > 50 ? -12 : 16)}%`}
                      textAnchor="middle"
                      fill={isCurrent ? '#FFF' : '#888'}
                      fontSize="9"
                      fontWeight="bold"
                      className="font-mono uppercase tracking-tighter pointer-events-none"
                    >
                      {node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Journey Trail Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
            <div className="bg-white/5 p-2 rounded border border-white/5">
              <span className="text-[8px] text-white/40 uppercase block">Trail Nodes Visited</span>
              <span className="text-xs font-bold font-mono text-[#FFE01A]">{activeStep + 1} / {journeyNodes.length} Hubs</span>
            </div>

            <div className="bg-white/5 p-2 rounded border border-white/5">
              <span className="text-[8px] text-white/40 uppercase block">Vector Score</span>
              <span className="text-xs font-bold font-mono text-emerald-400">
                {(selectedVector === 'nfc' ? 1.0 : selectedVector === 'qr' ? 0.8 : 0.5) * (activeStep + 1) * 1.5} pts
              </span>
            </div>

            <div className="bg-white/5 p-2 rounded border border-white/5">
              <span className="text-[8px] text-white/40 uppercase block">Trail Momentum</span>
              <span className="text-xs font-bold font-mono text-cyan-400">
                {activeStep > 1 ? '🔥 HIGH_FLOW' : '⚡ INITIATED'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
