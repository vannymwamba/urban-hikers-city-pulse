import React from 'react';
import { SponsorBadgeProps } from '../types';

export function SponsorBadge({ partner, zone, compact = false }: SponsorBadgeProps) {
  // Guard: no partner, no branding, or zone not assigned
  if (!partner) return null;
  if (!partner.logo_url && !partner.brand_color) return null;
  if (partner.sponsor_zones && !partner.sponsor_zones.includes(zone)) return null;

  // Zone A: presented-by bar at top of card
  if (zone === 'A') return (
    <div style={{
      background: (partner.brand_color ?? '#F5C518') + '15',
      borderBottom: `1px solid ${partner.brand_color ?? '#F5C518'}25`,
      padding: compact ? '3px 10px' : '5px 12px',
      display: 'flex', 
      alignItems: 'center', 
      gap: 8,
      fontSize: compact ? '9px' : '10px',
      color: partner.brand_color ?? '#F5C518',
      letterSpacing: '0.06em',
      fontWeight: 900,
      textTransform: 'uppercase'
    }}>
      {partner.logo_url &&
        <img 
          src={partner.logo_url} 
          height={compact ? 12 : 16} 
          alt={partner.name} 
          referrerPolicy="no-referrer"
        />}
      <span>{compact ? partner.name : `PRESENTED BY ${partner.name}`}</span>
    </div>
  );

  // Zone D: deal text strip at bottom of card
  if (zone === 'D' && partner.deal_text) return (
    <div style={{
      background: (partner.brand_color ?? '#F5C518') + '12',
      border: `1px solid ${partner.brand_color ?? '#F5C518'}30`,
      borderRadius: 8, 
      padding: '5px 10px', 
      marginTop: 6,
      fontSize: '10px', 
      color: partner.brand_color ?? '#F5C518',
      fontWeight: 700
    }}>
      ⭐ {partner.deal_text}
    </div>
  );

  return null;
}
