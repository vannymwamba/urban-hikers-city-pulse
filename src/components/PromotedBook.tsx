import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, ChevronRight, Volume2 } from 'lucide-react';
import type { PromotedBookConfig } from '../types';
import { normalizeAudioUrl } from '../utils/audioUrlHelper';

interface PromotedBookProps {
  config?: PromotedBookConfig | null;
  onBookClick?: () => void;
  className?: string;
}

// Default fallback configuration matching Mark E. Scott / Drunk Log
const DEFAULT_CONFIG: PromotedBookConfig = {
  author_name: 'MARK E. SCOTT',
  book_title: 'DRUNK LOG',
  copy: 'Listen to a 45 second sample from the book.',
  duration_str: '0:45',
  cover_url: '/drunk_log_cover.jpg',
  audio_url: '',
  purchase_url: ''
};

export const PromotedBook: React.FC<PromotedBookProps> = ({
  config,
  onBookClick,
  className = ''
}) => {
  const activeConfig = {
    ...DEFAULT_CONFIG,
    ...(config || {})
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const synthTimerRef = useRef<any>(null);

  // Initialize and handle playback
  const togglePlayback = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const startPlayback = () => {
    // 1. If an actual audio_url is provided, use standard HTML5 Audio with URL normalization
    const normalizedUrl = normalizeAudioUrl(activeConfig.audio_url);
    if (normalizedUrl) {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        const audio = audioRef.current;
        audio.src = normalizedUrl;
        audio.preload = 'auto';

        audio.onended = () => {
          setIsPlaying(false);
        };
        audio.onpause = () => {
          setIsPlaying(false);
        };
        audio.onplay = () => {
          setIsPlaying(true);
        };
        audio.onerror = (e) => {
          console.warn('Audio URL playback failed or blocked by CORS, falling back to Web Audio tone:', e);
          playWebAudioSample();
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(err => {
              console.warn('Audio play prevented or errored, falling back to Web Audio API:', err);
              playWebAudioSample();
            });
        }
        return;
      } catch (e) {
        console.warn('Failed to initialize audio element, falling back to synthesizer:', e);
        playWebAudioSample();
        return;
      }
    }

    // 2. Otherwise use Web Audio API to play an atmospheric narrative sample tone sequence
    playWebAudioSample();
  };

  const playWebAudioSample = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        setIsPlaying(true);
        return;
      }

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContextClass();
      }

      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      // Ambient warm voice-narration chord simulation
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Subtle pitch variation simulating audio reading
      osc.frequency.setValueAtTime(196.00, now); // G3
      osc.frequency.setValueAtTime(220.00, now + 0.5); // A3
      osc.frequency.setValueAtTime(246.94, now + 1.2); // B3
      osc.frequency.setValueAtTime(196.00, now + 2.0); // G3

      // Gentle attack and continuous ambient presence
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      oscRef.current = osc;
      gainNodeRef.current = gain;
      setIsPlaying(true);

      // Auto stop after 45 seconds if uninterrupted
      synthTimerRef.current = setTimeout(() => {
        stopPlayback();
      }, 45000);
    } catch (err) {
      console.warn('Web Audio playback failed:', err);
      setIsPlaying(true);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (oscRef.current && gainNodeRef.current && audioCtxRef.current) {
      try {
        const now = audioCtxRef.current.currentTime;
        gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, now);
        gainNodeRef.current.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        setTimeout(() => {
          try {
            oscRef.current?.stop();
            oscRef.current?.disconnect();
          } catch (e) {}
          oscRef.current = null;
          gainNodeRef.current = null;
        }, 220);
      } catch (err) {
        oscRef.current = null;
      }
    }

    if (synthTimerRef.current) {
      clearTimeout(synthTimerRef.current);
      synthTimerRef.current = null;
    }

    setIsPlaying(false);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  const handleCardClick = () => {
    if (onBookClick) {
      onBookClick();
    } else if (activeConfig.purchase_url) {
      window.open(activeConfig.purchase_url, '_blank', 'noopener,noreferrer');
    } else {
      togglePlayback();
    }
  };

  return (
    <div 
      id="promoted-local-writer-card"
      className={`bg-[#141416]/90 backdrop-blur-md border border-white/10 hover:border-[#F2C94C]/40 rounded-2xl p-3 pr-3.5 flex items-center gap-3.5 shadow-2xl transition-all max-w-[310px] w-full group cursor-pointer select-none ${className}`}
      onClick={handleCardClick}
      role="region"
      aria-label={`Promoted book: ${activeConfig.book_title} by ${activeConfig.author_name}`}
    >
      {/* Left Column: Promotion labels, copy, play button & waveform */}
      <div className="flex-1 flex flex-col min-w-0">
        <span className="font-mono text-[9px] font-extrabold text-[#F2C94C] tracking-[0.18em] uppercase leading-none mb-1">
          PROMOTED
        </span>
        <h4 className="text-white text-xs font-black uppercase tracking-tight leading-tight mb-1">
          LOCAL WRITER
        </h4>
        <p className="text-[#9CA3AF] text-[10px] leading-snug tracking-tight mb-2.5 line-clamp-2">
          {activeConfig.copy || 'Listen to a 45 second sample from the book.'}
        </p>

        {/* Audio Controls & Waveform */}
        <div className="flex items-center gap-2.5">
          <button 
            type="button"
            aria-label={isPlaying ? `Pause sample of ${activeConfig.book_title}` : `Play sample of ${activeConfig.book_title}`}
            onClick={togglePlayback}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-black shadow-md shrink-0 transition-all active:scale-95 ${
              isPlaying ? 'bg-[#F2C94C] ring-2 ring-[#F2C94C]/50' : 'bg-[#F2C94C] hover:bg-[#d9b33e]'
            }`}
          >
            {isPlaying ? (
              <Pause size={14} fill="black" className="text-black" />
            ) : (
              <Play size={14} fill="black" className="text-black ml-0.5" />
            )}
          </button>
          
          {/* Waveform graphic */}
          <div className="flex items-center gap-[2px] h-3.5" title={isPlaying ? "Playing sample" : "Audio sample ready"}>
            {[4, 9, 6, 12, 8, 14, 11, 7, 13, 10, 5, 8].map((h, i) => (
              <div 
                key={i} 
                className={`w-[2px] rounded-full transition-all duration-300 ${
                  isPlaying 
                    ? 'bg-[#F2C94C] animate-pulse' 
                    : 'bg-white/40'
                }`} 
                style={{ 
                  height: isPlaying ? `${Math.max(4, (h * (1 + (i % 3) * 0.25)))}px` : `${h}px`,
                  animationDelay: `${i * 70}ms`
                }} 
              />
            ))}
          </div>

          <span className="font-mono text-[10px] font-bold text-[#8A928B] tracking-wider ml-0.5 flex items-center gap-1">
            {isPlaying && <Volume2 size={10} className="text-[#F2C94C] animate-bounce" />}
            {activeConfig.duration_str || '0:45'}
          </span>
        </div>
      </div>

      {/* Right Column: Book Cover Thumbnail & Subtle Chevron */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="relative w-14 h-20 rounded-md overflow-hidden bg-black/80 border border-white/20 shadow-lg flex items-center justify-center group-hover:border-[#F2C94C]/60 transition-colors">
          <img 
            src={activeConfig.cover_url || '/drunk_log_cover.jpg'} 
            alt={`${activeConfig.book_title} by ${activeConfig.author_name}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.classList.add('bg-gradient-to-b', 'from-[#222]', 'to-black', 'p-1', 'flex', 'flex-col', 'justify-between');
                parent.innerHTML = `
                  <div class="text-[7px] font-black text-white leading-tight uppercase">${activeConfig.book_title}</div>
                  <div class="text-[6px] font-bold text-[#F2C94C] leading-none">${activeConfig.author_name}</div>
                `;
              }
            }}
          />
        </div>
        <ChevronRight size={14} className="text-white/40 group-hover:text-[#F2C94C] transition-colors shrink-0" />
      </div>
    </div>
  );
};
