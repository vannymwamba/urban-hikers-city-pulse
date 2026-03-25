import React from 'react';
import { SponsorBadgeProps } from '../types';
import { getTextOnColor } from '../lib/color';

export function SponsorBadge({ partner, zone, compact = false }: SponsorBadgeProps) {
  // Guard: no partner, no branding, or zone not assigned
  if (!partner) return null;
  const logoUrl = partner.logoUrl || partner.logo_url;
  const brandColor = partner.brandColor || partner.brand_color || '#FFE01A';
  const dealText = partner.dealText || partner.deal_text;
  const sponsorZones = partner.sponsorZones || partner.sponsor_zones;

  if (!logoUrl && !brandColor) return null;
  if (sponsorZones && !sponsorZones.includes(zone)) return null;

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
          {logoUrl &&
            <img 
              src={logoUrl} 
              className={`${compact ? 'h-4' : 'h-6'} w-auto max-w-[120px] object-contain bg-black/10 p-0.5 rounded shadow-sm`}
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
  if (zone === 'D' && dealText) {
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
        {logoUrl && (
          <img 
            src={logoUrl} 
            className="h-4 w-auto max-w-[80px] object-contain bg-white/20 p-0.5 rounded-sm shadow-sm"
            alt=""
            referrerPolicy="no-referrer"
          />
        )}
        <span className="flex-1 tracking-tight">
          {dealText?.toUpperCase() || ''}
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
