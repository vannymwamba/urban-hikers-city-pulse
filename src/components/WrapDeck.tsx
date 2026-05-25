import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Share2, 
  Award, 
  Compass, 
  Zap, 
  MapPin, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Flame,
  Volume2
} from 'lucide-react';
import { WrapStats } from '../types/wrap';

interface WrapDeckProps {
  data: WrapStats;
  onClose?: () => void;
}

export function WrapDeck({ data, onClose }: WrapDeckProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [copied, setCopied] = useState(false);
  
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const TOTAL_SLIDES = 6;

  const nextSlide = () => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  // Helper to format numbers with commas
  const formatNum = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  // Helper to get day name or clean date
  const formatDateStr = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Define transition animation settings
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0
    })
  };

  const [slideDirection, setSlideDirection] = useState(1);

  const changeSlide = (newIndex: number) => {
    const direction = newIndex > currentSlide ? 1 : -1;
    setSlideDirection(direction);
    setCurrentSlide(newIndex);
  };

  const handlePrevClick = () => {
    if (currentSlide > 0) {
      setSlideDirection(-1);
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleNextClick = () => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setSlideDirection(1);
      setCurrentSlide(prev => prev + 1);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-[#0a0a0a] text-white flex flex-col justify-between select-none overflow-hidden z-50 font-sans"
      id="wrap-deck-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Upper Grid Decoration (Subtle Cyberpunk HUD elements) */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.1)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-40" />

      {/* Header section (Progress bar & basic details) */}
      <div className="w-full max-w-md mx-auto pt-4 px-4 z-20 flex flex-col gap-3">
        {/* Story indicators */}
        <div className="flex gap-1.5 h-1 w-full" id="progress-indicator">
          {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
            <div 
              key={idx} 
              className="h-full flex-1 bg-neutral-800 rounded-full overflow-hidden cursor-pointer"
              onClick={() => changeSlide(idx)}
            >
              <div 
                className={`h-full transition-all duration-300 ${
                  idx <= currentSlide ? 'bg-[#FFE01A]' : 'bg-transparent'
                }`}
                style={{
                  width: idx === currentSlide ? '100%' : idx < currentSlide ? '100%' : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Co-branded Header info */}
        <div className="flex justify-between items-center text-xs text-neutral-400 font-mono" id="deck-metadata">
          <div className="flex items-center gap-1.5 tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>LOCAL_PULSE_REPORT_V2</span>
          </div>
          <div className="tracking-widest font-semibold uppercase text-neutral-300">
            {data.season}
          </div>
        </div>
      </div>

      {/* Main Slide Content Frame */}
      <div className="flex-1 w-full max-w-md mx-auto px-6 flex items-center justify-center relative py-6 z-20">
        <AnimatePresence initial={false} custom={slideDirection} mode="wait">
          <motion.div
            key={currentSlide}
            custom={slideDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="w-full flex flex-col justify-between h-[65vh] focus:outline-none"
            id={`slide-${currentSlide}`}
          >
            {/* Slide 1: Hero */}
            {currentSlide === 0 && (
              <div className="flex flex-col justify-between h-full text-left">
                <div className="space-y-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-[#FFE01A] font-mono flex items-center gap-1">
                    <Zap size={14} className="fill-[#FFE01A] text-[#FFE01A]" />
                    <span>ANNUAL_METALLIC_WRAP</span>
                  </div>
                  <h1 className="text-5xl font-black tracking-tight leading-[0.95] text-white uppercase italic">
                    {data.vendorName}
                  </h1>
                  <p className="text-neutral-400 font-mono text-sm max-w-[280px]">
                    Your physical signal broadcast nodes illuminated local streets during the <span className="text-white font-semibold">{data.season}</span> active season.
                  </p>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 p-6 space-y-4 rounded-lg relative overflow-hidden backdrop-blur-md">
                  <div className="absolute -right-8 -bottom-8 opacity-5 text-neutral-400 font-bold scale-[5]">
                    ★
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-mono">SEASONAL_TAPS_INDEX</div>
                    <div className="text-5xl font-black text-[#FFE01A] tracking-tighter tabular-nums drop-shadow-[0_0_20px_rgba(255,224,26,0.3)]">
                      {formatNum(data.totalTaps)}
                    </div>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-neutral-800">
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-mono">SECTORS_TOUCHED</div>
                      <div className="text-base font-extrabold uppercase text-white font-mono">{data.uniqueLocations} HUBS</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-[0.15em] text-neutral-500 font-mono">STATUS</div>
                      <div className="text-base font-extrabold uppercase text-emerald-400 font-mono">PREMIUM</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slide 2: Discovery & Peak Day */}
            {currentSlide === 1 && (
              <div className="flex flex-col justify-between h-full text-left">
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-[#FFE01A] font-mono flex items-center gap-1">
                    <Flame size={14} className="fill-red-500 text-red-500" />
                    <span>PEAK_VELOCITY</span>
                  </div>
                  <h2 className="text-4xl font-extrabold tracking-tight leading-[1] uppercase py-1">
                    YOUR POWER HIGHLIGHT
                  </h2>
                  <p className="text-neutral-400 text-sm max-w-[320px]">
                    Local explorers tuned in to your signals with massive density. Your broadcast peaked with extreme kinetic energy on a single day.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Big Peak Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-md">
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">PEAK_DATE</div>
                      <div className="text-lg font-bold text-white mt-1">
                        {formatDateStr(data.peakDayDate)}
                      </div>
                    </div>
                    <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-md">
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">PEAK_DENSITY</div>
                      <div className="text-2xl font-black text-[#FFE01A] mt-1 tabular-nums">
                        {formatNum(data.peakDayTaps)} <span className="text-xs font-mono font-medium text-white">taps</span>
                      </div>
                    </div>
                  </div>

                  {/* Aesthetic waveform visual decoration */}
                  <div className="h-16 flex items-end gap-1.5 px-2 bg-gradient-to-t from-neutral-950 to-transparent pt-4">
                    {[12, 18, 32, 24, 45, 60, 95, 80, 52, 38, 55, 78, 100, 68, 48, 32, 14, 20, 16].map((h, i) => (
                      <div 
                        key={i} 
                        className={`flex-1 rounded-t-sm transition-all duration-1000 ${
                          i === 12 ? 'bg-[#FFE01A]' : 'bg-neutral-800'
                        }`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="text-[9px] uppercase tracking-widest text-[#FFE01A] font-mono text-center">
                    SYSTEM_VOLTAGE_SPIKE AT 6:00 PM LOCAL TIME_
                  </div>
                </div>
              </div>
            )}

            {/* Slide 3: Top spots bar chart */}
            {currentSlide === 2 && (
              <div className="flex flex-col justify-between h-full text-left">
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-[#FFE01A] font-mono flex items-center gap-1.5">
                    <MapPin size={14} className="text-[#FFE01A]" />
                    <span>HOT_SECTOR_ZONES</span>
                  </div>
                  <h2 className="text-4xl font-extrabold tracking-tight leading-[1] uppercase">
                    YOUR STRONGEST NODES
                  </h2>
                  <p className="text-neutral-400 text-sm">
                    Urban Hikers discovered your ecosystem and verified their presence across these top community locations.
                  </p>
                </div>

                <div className="space-y-4">
                  {data.topLocations.slice(0, 4).map((loc, i) => {
                    const maxTaps = Math.max(...data.topLocations.map(l => l.taps), 1);
                    const pct = Math.round((loc.taps / maxTaps) * 100);
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono text-neutral-300">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="text-[#FFE01A] font-bold">0{i+1}.</span>
                            <span className="truncate max-w-[200px] uppercase font-bold text-white">{loc.name}</span>
                          </span>
                          <span className="font-bold tracking-tight text-[#FFE01A] tabular-nums">{loc.taps} taps</span>
                        </div>
                        {/* Horizontal Bar */}
                        <div className="h-5 bg-neutral-950 border border-neutral-900 overflow-hidden flex items-center pr-2 rounded">
                          <div 
                            className="h-full bg-gradient-to-r from-neutral-900 to-[#FFE01A] transition-all duration-1000 flex items-center pl-2 rounded-r"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Slide 4: Walk connections */}
            {currentSlide === 3 && (
              <div className="flex flex-col justify-between h-full text-left">
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-[#FFE01A] font-mono flex items-center gap-1.5">
                    <Users size={14} className="text-[#FFE01A]" />
                    <span>WALK_INJECTION_PROTOCOL</span>
                  </div>
                  <h2 className="text-4xl font-extrabold tracking-tight leading-[1] uppercase">
                    GUILDS AND HIKE TREKS
                  </h2>
                  <p className="text-neutral-400 text-sm">
                    Our local street hiking network routes actual human groups right to key portals. Your metrics was fueled significantly by street walking groups.
                  </p>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 p-5 rounded-lg space-y-5">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">HIKE-DRIVEN ACTIVITY</div>
                      <div className="text-3xl font-black text-white mt-1 tabular-nums">
                        {formatNum(data.walkDrivenTaps)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">TOTAL RATIO</div>
                      <div className="text-3xl font-black text-[#FFE01A] mt-1 tabular-nums">
                        {data.walkDrivenPct}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-[#FFE01A]/5 border border-[#FFE01A]/20 p-3.5 rounded-md">
                    <div className="w-10 h-10 rounded-full bg-[#FFE01A] text-black flex items-center justify-center font-bold">
                      <Compass size={20} className="animate-spin-slow" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-mono">COMMUNITY_NETWORKS</div>
                      <div className="text-sm font-extrabold text-white uppercase mt-0.5">
                        {data.walksConnected} Walks Directed To Your Hubs
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slide 5: Boost ROI */}
            {currentSlide === 4 && (
              <div className="flex flex-col justify-between h-full text-left">
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-[#FFE01A] font-mono flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-[#FFE01A]" />
                    <span>BOOST_ENGINE_ROI</span>
                  </div>
                  <h2 className="text-4xl font-extrabold tracking-tight leading-[1] uppercase">
                    HYPERPOWERED RETURNEES
                  </h2>
                  <p className="text-neutral-400 text-sm">
                    You activated digital boost campaigns to trigger alerts, map updates, and push signals during major city events.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-md">
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">TOTAL BOOST IMPULSE</div>
                      <div className="text-xl font-bold text-white mt-1 font-mono">
                        ${formatNum(data.totalBoostSpend)}
                      </div>
                    </div>
                    <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-md">
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">TOTAL IMPRESSIONS</div>
                      <div className="text-xl font-bold text-[#FFE01A] mt-1 font-mono">
                        {formatNum(data.totalBoostReach)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800 p-5 rounded-md flex flex-col justify-center items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-[#FFE01A] text-neutral-950 text-[8px] uppercase tracking-widest font-mono font-bold px-2.5 py-0.5 rounded-bl">
                      ROI ENGINE
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-mono mb-1">BOOST ROI MULTIPLIER</div>
                    <div className="text-4xl font-black text-white font-mono tracking-tighter">
                      +{data.boostRoiPerDollar.toFixed(1)}x <span className="text-[#FFE01A] text-lg font-bold font-sans">VALUE</span>
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-mono mt-2">
                      IN PARTNERSHIP_COMMUNITY RE-ENGAGEMENT RATIO
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slide 6: Rank + Share */}
            {currentSlide === 5 && (
              <div className="flex flex-col justify-between h-full text-left">
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-[#FFE01A] font-mono flex items-center gap-1.5">
                    <Award size={14} className="text-[#FFE01A]" />
                    <span>SYNCHRONIZATION_SCORE</span>
                  </div>
                  <h2 className="text-4xl font-extrabold tracking-tight leading-[1] uppercase">
                    CITY CHAMPION RECOGNIZED
                  </h2>
                  <p className="text-neutral-400 text-sm">
                    Your location made a massive physical imprint on the local fabric. You're in a high tier of our entire city-wide active registry.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 border-2 border-[#FFE01A] p-6 rounded-lg text-center relative overflow-hidden shadow-[0_0_30px_rgba(255,224,26,0.1)]">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[#FFE01A] font-mono mb-2">SEASONAL_DENSITY_STANDING</div>
                  
                  {data.percentileRank !== null ? (
                    <div className="text-5xl font-black text-white tracking-widest uppercase italic my-2">
                      TOP {data.percentileRank}%
                    </div>
                  ) : (
                    <div className="text-3xl font-black text-white tracking-widest uppercase italic my-2">
                      VERIFIED PARTNER
                    </div>
                  )}

                  <div className="text-xs text-neutral-400 font-mono mb-4">
                    Active out of {data.totalVendorsInSeason} city partners registered.
                  </div>

                  {/* Share button */}
                  <button 
                    onClick={handleShare}
                    className="w-full bg-[#FFE01A] text-neutral-950 hover:bg-white hover:text-black transition-colors font-bold uppercase tracking-widest text-xs py-3 px-4 rounded font-mono inline-flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
                    id="share-stats-btn"
                  >
                    <Share2 size={16} />
                    <span>{copied ? 'PROTOCOL_LINK_COPIED!' : 'SHARE_PULSE_WRAP'}</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide Navigation controls */}
      <div className="w-full max-w-md mx-auto px-6 pb-8 pt-2 z-20 flex justify-between items-center" id="nav-controls">
        <button 
          onClick={handlePrevClick}
          disabled={currentSlide === 0}
          className={`flex items-center gap-1 uppercase tracking-widest font-mono text-xs font-bold py-3 px-4 bg-neutral-950 border border-neutral-800 rounded transition-colors focus:outline-none ${
            currentSlide === 0 ? 'text-neutral-600 border-neutral-900 cursor-not-allowed' : 'text-neutral-300 hover:text-[#FFE01A] hover:border-[#FFE01A]'
          }`}
          id="prev-slide-btn"
        >
          <ChevronLeft size={16} />
          <span>PREV</span>
        </button>

        {onClose && (
          <button 
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 border border-neutral-850 bg-neutral-900/40 rounded-full hover:bg-neutral-800 hover:text-red-400 transition-colors cursor-pointer"
            id="close-deck-btn"
          >
            <X size={16} />
          </button>
        )}

        <button 
          onClick={handleNextClick}
          disabled={currentSlide === TOTAL_SLIDES - 1}
          className={`flex items-center gap-1 uppercase tracking-widest font-mono text-xs font-bold py-3 px-4 bg-neutral-950 border border-neutral-800 rounded transition-colors focus:outline-none ${
            currentSlide === TOTAL_SLIDES - 1 ? 'text-neutral-600 border-neutral-900 cursor-not-allowed' : 'text-neutral-300 hover:text-[#FFE01A] hover:border-[#FFE01A]'
          }`}
          id="next-slide-btn"
        >
          <span>NEXT</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
