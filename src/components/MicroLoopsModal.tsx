import React from 'react';
import { X, Navigation, Footprints, Clock, MapPin, Sparkles, Coffee } from 'lucide-react';

export interface MicroLoop {
  id: string;
  title: string;
  subtitle: string;
  durationMinutes: number;
  distanceMiles: number;
  stopsCount: number;
  tag: string;
  themeColor: string;
  description: string;
  stops: {
    name: string;
    note: string;
    distanceStr: string;
  }[];
  googleMapsQuery: string;
}

interface MicroLoopsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocationName?: string;
}

export function MicroLoopsModal({ isOpen, onClose, currentLocationName = 'Current Artwork' }: MicroLoopsModalProps) {
  if (!isOpen) return null;

  const loops: MicroLoop[] = [
    {
      id: 'mural-projection',
      title: 'Mural & Projection Circuit',
      subtitle: 'Urban Hikers Curated Route 01',
      durationMinutes: 30,
      distanceMiles: 1.1,
      stopsCount: 4,
      tag: 'FASTEST LOOP',
      themeColor: '#F2C94C',
      description: 'Night-vision route connecting glowing architectural projections and monumental street murals.',
      stops: [
        { name: currentLocationName, note: 'Starting Point', distanceStr: '0 min' },
        { name: 'Jessica Watts Mural', note: 'Monumental portrait with gold foil elements', distanceStr: '180 yd · 2 min' },
        { name: 'Woodward St Projection Facade', note: 'Live motion mapped over 1880s brick', distanceStr: '420 yd · 6 min' },
        { name: 'Ziegler Park Gateway', note: 'Interactive light canopy & sound node', distanceStr: '0.4 mi · 8 min' },
      ],
      googleMapsQuery: 'Ziegler Park, Cincinnati, OH',
    },
    {
      id: 'coffee-refuel',
      title: 'Coffee & Refuel Walk',
      subtitle: 'Urban Hikers Curated Route 02',
      durationMinutes: 28,
      distanceMiles: 0.9,
      stopsCount: 3,
      tag: 'PERK ROUTE',
      themeColor: '#FFE01A',
      description: 'Quiet brick courtyards, heritage architecture, and a direct stop at Urbana Cafe for your 3-tap reward.',
      stops: [
        { name: currentLocationName, note: 'Starting Point', distanceStr: '0 min' },
        { name: 'Urbana Cafe (1206 Vine St)', note: 'Refuel Perk Stop · Counter Code UH', distanceStr: '250 yd · 3 min' },
        { name: 'Pleasant St Historic Brickway', note: 'Illuminated ironwork and alleyway murals', distanceStr: '380 yd · 5 min' },
        { name: 'Washington Park Civic Center', note: 'Open plaza projection and fountain lighting', distanceStr: '0.3 mi · 6 min' },
      ],
      googleMapsQuery: 'Urbana Cafe, 1206 Vine St, Cincinnati, OH',
    },
    {
      id: 'canal-heritage',
      title: 'Canal Heritage & Sound Loop',
      subtitle: 'Urban Hikers Curated Route 03',
      durationMinutes: 35,
      distanceMiles: 1.3,
      stopsCount: 4,
      tag: 'HISTORY & AUDIO',
      themeColor: '#93C5FD',
      description: 'Follow the historic subterranean canal corridor through immersive ambient sound installations.',
      stops: [
        { name: currentLocationName, note: 'Starting Point', distanceStr: '0 min' },
        { name: 'Miami-Erie Canal Marker', note: 'Sub-surface acoustic sound sculpture', distanceStr: '350 yd · 4 min' },
        { name: 'Liberty St Historic Arcade', note: 'Interactive color-shifting light tunnels', distanceStr: '0.4 mi · 7 min' },
        { name: 'Findlay Arts Alley', note: 'Community street art gallery & neon displays', distanceStr: '0.4 mi · 8 min' },
      ],
      googleMapsQuery: 'Findlay Market, Cincinnati, OH',
    },
  ];

  const handleStartLoop = (loop: MicroLoop) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loop.googleMapsQuery)}&travelmode=walking`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] bg-[#141417] border border-white/10 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <Footprints size={15} className="text-[#F2C94C]" />
              <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-[#F2C94C] uppercase">
                URBAN HIKERS EXPERTISE
              </span>
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight mt-0.5">
              Curated 30-Min Loops
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close loops"
            className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/15 flex items-center justify-center transition-colors"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Scrollable Loops Content */}
        <div className="overflow-y-auto p-5 flex flex-col gap-4">
          <p className="text-xs text-[#8A928B] leading-relaxed">
            Need a focused route that keeps you moving? These self-guided micro-loops start right where you stand and loop back in under 30 minutes.
          </p>

          {loops.map((loop) => (
            <div
              key={loop.id}
              className="bg-[#1C1C21] rounded-2xl border border-white/10 p-4 flex flex-col gap-3 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-[#F2C94C]/20 text-[#F2C94C] uppercase tracking-wider">
                      {loop.tag}
                    </span>
                    <span className="font-mono text-[9px] text-[#8A928B] uppercase tracking-wider">
                      {loop.subtitle}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white uppercase">
                    {loop.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px] text-[#8A928B] uppercase shrink-0">
                  <span className="flex items-center gap-1 text-[#F2C94C]">
                    <Clock size={12} />
                    {loop.durationMinutes}M
                  </span>
                  <span>•</span>
                  <span>{loop.distanceMiles} MI</span>
                </div>
              </div>

              <p className="text-xs text-[#8A928B]">
                {loop.description}
              </p>

              {/* Stops list */}
              <div className="space-y-1.5 pt-1 border-t border-white/5">
                {loop.stops.map((stop, sIdx) => (
                  <div key={sIdx} className="flex items-start gap-2.5 text-xs">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-2 h-2 rounded-full bg-[#F2C94C]" />
                      {sIdx < loop.stops.length - 1 && <div className="w-[1px] h-4 bg-white/20 my-0.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-[11px] truncate uppercase">{stop.name}</span>
                        <span className="font-mono text-[9px] text-[#8A928B] shrink-0 ml-2">{stop.distanceStr}</span>
                      </div>
                      <span className="text-[10px] text-[#8A928B] block truncate">{stop.note}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Start loop CTA */}
              <button
                type="button"
                onClick={() => handleStartLoop(loop)}
                className="w-full min-h-[44px] bg-[#F2C94C] hover:bg-[#d9b33e] text-[#0B0B0D] font-black text-xs uppercase tracking-wide rounded-xl py-2.5 px-4 flex items-center justify-between transition-colors mt-1"
              >
                <span className="flex items-center gap-2">
                  <Navigation size={14} />
                  <span>Start Loop in Maps</span>
                </span>
                <span className="font-mono text-[10px] opacity-80">~{loop.durationMinutes} min</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
