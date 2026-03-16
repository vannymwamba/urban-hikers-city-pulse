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
    const isSponsored = !!(partner.logo_url || partner.brand_color);
    
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
            PRESENTED BY {partner.name.toUpperCase()}
          </span>
        </div>
        
        {isSponsored && (
          <div className="bg-black/20 text-white/70 text-[9px] px-2 py-0.5 rounded-full font-black flex items-center gap-1">
            📌 PINNED
          </div>
        )}
      </div>
    );
  }

  // Zone D: deal text strip at bottom of card
  if (zone === 'D' && partner.deal_text) return (
    <div style={{
      background: 'var(--color-brand-dim)',
      border: `1px solid var(--color-brand-border)`,
      borderRadius: 8, 
      padding: '5px 10px', 
      marginTop: 6,
      fontSize: '10px', 
      color: 'var(--color-brand)',
      fontWeight: 700,
      fontFamily: 'var(--font-content)'
    }}>
      ⭐ {partner.deal_text}
    </div>
  );

  return null;
}
