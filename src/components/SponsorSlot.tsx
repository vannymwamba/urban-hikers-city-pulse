import React from 'react';
import type { DisplaySponsor } from '../types';

interface SponsorSlotProps {
  variant: 'hero' | 'wayfinding' | 'lostFound' | 'footer' | 'audio' | 'node';
  sponsor: DisplaySponsor | undefined;
}

export const SponsorSlot: React.FC<SponsorSlotProps> = ({ variant, sponsor }) => {
  if (!sponsor) return null;

  const renderLabel = () => {
    switch (variant) {
      case 'hero':
      case 'lostFound':
      case 'wayfinding':
        return 'Presented by';
      case 'audio':
        return 'Hear the Artist, Presented by';
      case 'node':
        return 'Supported by';
      case 'footer':
        return 'Powered by';
      default:
        return 'Presented by';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'hero':
        return "flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10 w-fit pointer-events-auto mt-1";
      case 'wayfinding':
        return "flex items-center gap-2 mt-2 justify-center";
      case 'lostFound':
        return "flex items-center gap-2 mt-2 mb-1 justify-center";
      case 'footer':
        return "flex items-center gap-2 justify-center mt-2 w-full";
      case 'audio':
        return "flex items-center gap-2 mt-1";
      case 'node':
        return "flex items-center gap-2 mt-2 pt-3 border-t border-white/10";
      default:
        return "flex items-center gap-2";
    }
  };

  const getLabelStyles = () => {
    if (variant === 'hero' || variant === 'audio' || variant === 'node') {
      return "text-[#A0A8A1] text-[10px] uppercase tracking-wider font-mono font-bold";
    }
    return "text-[#A0A8A1] text-[10px] uppercase tracking-widest font-mono font-bold";
  };

  return (
    <a 
      href={sponsor.link} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`${getVariantStyles()} group transition-opacity hover:opacity-80`}
    >
      <span className={getLabelStyles()}>
        {renderLabel()}
      </span>
      {sponsor.logoUrl ? (
        <img 
          src={sponsor.logoUrl} 
          alt={sponsor.name} 
          className="h-5 w-auto max-w-[100px] object-contain drop-shadow-md"
        />
      ) : (
        <span className="text-white text-xs font-bold tracking-wide">
          {sponsor.name}
        </span>
      )}
    </a>
  );
};
