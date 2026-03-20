import React from 'react';
import { SponsorBadgeProps } from '../types';
import { getTextOnColor } from '../lib/color';

export function SponsorBadge({ partner, zone, compact = false }: SponsorBadgeProps) {
  // Guard: no partner, no branding, or zone not assigned
  if (!partner) return null;
  if (!partner.logo_url && !partner.brand_color) return null;
  if (partner.sponsor_zones && !partner.sponsor_zones.includes(zone)) return null;

  const brandColor = partner.brand_color ?? '#FFE01A';
  const textColor = getTextOnColor(brandColor);

  // Zone A: presented-by bar at top of card
  if (zone === 'A') {
    return (
      <div style={{
        background: brandColor,
        borderBottom: `1px solid rgba(0,0,0,0.1)`,
        padding: compact ? '4px 10px' : '8px 12px',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        gap: 8,
        fontSize: compact ? '9px' : '10px',
        color: textColor,
        letterSpacing: '0.06em',
        fontWeight: 900,
        textTransform: 'uppercase',
        fontFamily: 'var(--font-system)'
      }}>
        <div className="flex items-center gap-2">
          {partner.logo_url &&
            <img 
              src={partner.logo_url} 
              className="h-4 w-auto object-contain bg-black/10 p-0.5 rounded"
              alt={partner.name} 
              referrerPolicy="no-referrer"
            />}
          <span className="font-black tracking-tighter">
            PRESENTED BY {partner.name?.toUpperCase() || 'UNKNOWN'}
          </span>
        </div>
        
        <div className="bg-black/20 text-white/70 text-[9px] px-2 py-0.5 rounded-full font-black flex items-center gap-1">
          📌 PINNED
        </div>
      </div>
    );
  }

  // Zone D: deal text strip at bottom of card
  if (zone === 'D' && partner.deal_text) {
    const dimBg = `${brandColor}1A`; // ~10% opacity hex
    const borderBg = `${brandColor}4D`; // ~30% opacity hex
    
    return (
      <div style={{
        background: dimBg,
        border: `1px solid ${borderBg}`,
        borderRadius: 8, 
        padding: '6px 10px', 
        marginTop: 8,
        fontSize: '10px', 
        color: brandColor,
        fontWeight: 800,
        fontFamily: 'var(--font-content)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        {partner.logo_url && (
          <img 
            src={partner.logo_url} 
            className="h-3.5 w-auto object-contain bg-white/20 p-0.5 rounded-sm"
            alt=""
            referrerPolicy="no-referrer"
          />
        )}
        <span className="flex-1 tracking-tight">
          {partner.deal_text?.toUpperCase() || ''}
        </span>
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded text-[8px] font-black opacity-80">
          <span className="w-1 h-1 rounded-full" style={{ background: brandColor }} />
          PROMO
        </div>
      </div>
    );
  }

  return null;
}
