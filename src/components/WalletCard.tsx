import React from 'react';
import { Node } from '../types';

interface WalletCardProps {
  sector: Node;
  vibe?: string;
}

/**
 * Urban Hikers Local Pulse OS: WalletCard
 * Design System: Tactical HUD
 */
export const WalletCard: React.FC<WalletCardProps> = ({ sector, vibe = 'UNKNOWN' }) => {
  const { name, id: slug, address } = sector;
  const tapUrl = `${window.location.origin}/tap/${slug}`;

  // Color Palette
  const colors = {
    magenta: '#ff2d78',
    neonGreen: '#39ff14',
    safetyYellow: '#ffe600',
    deepBlack: '#0a0a0a',
  };

  return (
    <div 
      className="relative w-full max-w-md overflow-hidden border-2 p-1 font-mono uppercase tracking-tighter shadow-[0_0_20px_rgba(255,45,120,0.2)]"
      style={{ 
        backgroundColor: colors.deepBlack, 
        borderColor: colors.magenta,
      }}
    >
      {/* Scanline Overlay Effect */}
      <div className="pointer-events-none absolute inset-0 z-10 opacity-10" 
           style={{ background: 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.25) 50%), linear-gradient(90deg, rgba(255,0,0,0.06), rgba(0,255,0,0.02), rgba(0,0,255,0.06))', backgroundSize: '100% 2px, 3px 100%' }}></div>

      {/* Header: Sector ID & Status */}
      <div className="flex justify-between border-b border-dashed p-2 text-[10px] font-bold" style={{ borderColor: `${colors.magenta}44` }}>
        <div style={{ color: colors.neonGreen }}>
          [SECTOR_ID: {slug.replace('sector-', '').toUpperCase()}]
        </div>
        <div className="flex items-center gap-1" style={{ color: colors.neonGreen }}>
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: colors.neonGreen }}></span>
          STATUS_ACTIVE
        </div>
      </div>

      {/* Main Body: Sector Name */}
      <div className="p-4">
        <div className="mb-1 text-[9px] opacity-50" style={{ color: colors.neonGreen }}>SIGNAL_SOURCE_NAME</div>
        <h2 className="text-2xl font-black leading-none" style={{ color: colors.neonGreen }}>
          {name}
        </h2>
      </div>

      {/* Data Grid: Vibe & Location */}
      <div className="grid grid-cols-2 border-t border-b" style={{ borderColor: colors.magenta }}>
        <div className="border-r p-3" style={{ borderColor: colors.magenta }}>
          <div className="mb-1 text-[9px] opacity-50" style={{ color: colors.neonGreen }}>CURRENT_VIBE</div>
          <div className="text-sm font-bold" style={{ color: colors.safetyYellow }}>
            {vibe}
          </div>
        </div>
        <div className="p-3">
          <div className="mb-1 text-[9px] opacity-50" style={{ color: colors.neonGreen }}>GEO_LOCATION</div>
          <div className="truncate text-[10px] font-bold" style={{ color: colors.neonGreen }}>
            {address || 'COORDINATES_ONLY'}
          </div>
        </div>
      </div>

      {/* Footer: Tap URL & NFC Indicator */}
      <div className="flex items-center justify-between bg-white/5 p-2">
        <div className="flex flex-col">
          <div className="text-[8px] opacity-40" style={{ color: colors.neonGreen }}>ACCESS_VECTOR_URL</div>
          <div className="text-[9px] font-bold lowercase tracking-normal" style={{ color: colors.neonGreen }}>
            {tapUrl}
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: colors.safetyYellow }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.safetyYellow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 8.5V5a2 2 0 0 1 2-2h3" />
            <path d="M14 3h3a2 2 0 0 1 2 2v3.5" />
            <path d="M19 15.5V19a2 2 0 0 1-2 2h-3" />
            <path d="M10 21H7a2 2 0 0 1-2-2v-3.5" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </div>
      </div>

      {/* Decorative Corner Brackets */}
      <div className="absolute top-0 left-0 h-2 w-2 border-t-2 border-l-2" style={{ borderColor: colors.neonGreen }}></div>
      <div className="absolute top-0 right-0 h-2 w-2 border-t-2 border-r-2" style={{ borderColor: colors.neonGreen }}></div>
      <div className="absolute bottom-0 left-0 h-2 w-2 border-b-2 border-l-2" style={{ borderColor: colors.neonGreen }}></div>
      <div className="absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2" style={{ borderColor: colors.neonGreen }}></div>
    </div>
  );
};
