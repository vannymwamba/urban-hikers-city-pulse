/**
 * LocalPulseLoader.tsx
 * Urban Hikers — Local Pulse OS
 * Branded loading system — drop-in for any loading state in the app
 *
 * Usage:
 *   import { LocalPulseLoader } from './LocalPulseLoader'
 *
 *   // Full screen (route transitions, hub load, NFC tap)
 *   <LocalPulseLoader variant="full" label="Scanning city" />
 *
 *   // Signal card skeletons (feed loading)
 *   <LocalPulseLoader variant="card" count={3} />
 *
 *   // Inline dots (buttons, micro actions)
 *   <LocalPulseLoader variant="dots" />
 *
 *   // Bar sweep (admin dashboard, text lists)
 *   <LocalPulseLoader variant="bars" />
 */

import React, { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoaderVariant = 'full' | 'card' | 'dots' | 'bars'

export type FullLoaderLabel =
  | 'Scanning city'
  | 'Igniting node'
  | 'Tuning signal'
  | 'Checking vibe'
  | 'Loading hub'
  | 'Authenticating'
  | string

interface LocalPulseLoaderProps {
  variant?: LoaderVariant
  /** Full variant: contextual label shown below the NFC ring */
  label?: FullLoaderLabel
  /** Card variant: how many skeleton cards to render */
  count?: number
  /** Full variant: override background color */
  background?: string
  /** Optional className for the root wrapper */
  className?: string
  /** Pulse click handler */
  onPulseClick?: () => void
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function LocalPulseLoader({
  variant = 'full',
  label = 'Scanning city',
  count = 2,
  background = '#0a0a0a',
  className = '',
  onPulseClick,
}: LocalPulseLoaderProps) {
  if (variant === 'dots') return <DotLoader className={className} />
  if (variant === 'bars') return <BarLoader className={className} />
  if (variant === 'card') return <CardSkeletonList count={count} className={className} />
  return <FullLoader label={label} background={background} className={className} onPulseClick={onPulseClick} />
}

// ─── Full Screen Loader ───────────────────────────────────────────────────────

function FullLoader({
  label,
  background,
  className,
  onPulseClick,
}: {
  label: FullLoaderLabel
  background: string
  className: string
  onPulseClick?: () => void
}) {
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const id = setInterval(() => {
      setDots(d => (d.length >= 3 ? '.' : d + '.'))
    }, 400)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        zIndex: 9999,
        fontFamily: "'Space Mono', monospace",
      }}
    >
      {/* NFC Pulse Ring */}
      <div 
        onClick={onPulseClick}
        style={{ 
          position: 'relative', 
          width: 200, 
          height: 200, 
          display: 'flex', 
          alignItems: 'center', 
          justifySelf: 'center', 
          justifyContent: 'center',
          cursor: onPulseClick ? 'pointer' : 'default'
        }}
      >
        {/* Animated rings */}
        {[
          { size: 80, delay: '0s' },
          { size: 128, delay: '0.25s' },
          { size: 180, delay: '0.5s' },
        ].map(({ size, delay }, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: '50%',
              border: '1.5px solid #FFE01A',
              opacity: 0,
              animation: `lp-ring 1.8s ease-out infinite`,
              animationDelay: delay,
            }}
          />
        ))}

        {/* Center node */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#FFE01A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            flexShrink: 0,
          }}
        >
          <NfcIcon />
        </div>
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.22em',
          color: '#666',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        {label}
        <span style={{ color: '#FFE01A', animation: 'lp-blink 1.2s ease-in-out infinite' }}>
          {dots}
        </span>
      </div>

      <style>{`
        @keyframes lp-ring {
          0%   { opacity: 0; transform: scale(0.6); }
          20%  { opacity: 0.7; }
          100% { opacity: 0; transform: scale(1.4); }
        }
        @keyframes lp-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
      `}</style>
    </div>
  )
}

// ─── Card Skeleton ────────────────────────────────────────────────────────────

function CardSkeletonList({ count, className }: { count: number; className: string }) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', padding: '0 24px' }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
      <style>{`
        @keyframes lp-sweep {
          0%   { left: -60%; }
          100% { left: 120%; }
        }
      `}</style>
    </div>
  )
}

function CardSkeleton() {
  const shimmer: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    background: '#e5e5e5',
  }

  const shimmerAfter = `
    .lp-skel-shim::after {
      content: '';
      position: absolute;
      left: -60%;
      top: 0;
      width: 60%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,224,26,0.3), transparent);
      animation: lp-sweep 1.6s ease-in-out infinite;
    }
  `

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '32px',
        overflow: 'hidden',
        fontFamily: "'Space Mono', monospace",
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      }}
    >
      {/* Image area */}
      <div className="lp-skel-shim" style={{ ...shimmer, height: 260 }} />

      {/* Body */}
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Badge row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="lp-skel-shim" style={{ ...shimmer, height: 24, width: 100, borderRadius: 20 }} />
          <div className="lp-skel-shim" style={{ ...shimmer, height: 24, width: 80, borderRadius: 20 }} />
        </div>
        {/* Title */}
        <div className="lp-skel-shim" style={{ ...shimmer, height: 28, width: '85%' }} />
        <div className="lp-skel-shim" style={{ ...shimmer, height: 20, width: '55%' }} />
        {/* Address row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div className="lp-skel-shim" style={{ ...shimmer, height: 16, width: '60%' }} />
          <div className="lp-skel-shim" style={{ ...shimmer, height: 44, width: 100, borderRadius: 32 }} />
        </div>
      </div>
      <style>{shimmerAfter}</style>
    </div>
  )
}

// ─── Bar Loader ───────────────────────────────────────────────────────────────

function BarLoader({ className }: { className: string }) {
  const widths = ['90%', '72%', '85%', '50%', '78%']

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        fontFamily: "'Space Mono', monospace",
      }}
    >
      {widths.map((w, i) => (
        <div
          key={i}
          className="lp-skel-shim-bar"
          style={{
            position: 'relative',
            overflow: 'hidden',
            height: 8,
            width: w,
            background: '#e5e5e5',
            borderRadius: '4px',
          }}
        />
      ))}
      <style>{`
        @keyframes lp-sweep-bar {
          0%   { left: -60%; }
          100% { left: 120%; }
        }
        .lp-skel-shim-bar::after {
          content: '';
          position: absolute;
          left: -60%;
          top: 0;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,224,26,0.5), transparent);
          animation: lp-sweep-bar 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

// ─── Dot Loader ───────────────────────────────────────────────────────────────

function DotLoader({ className }: { className: string }) {
  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
    >
      {[0, 0.15, 0.3].map((delay, i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#FFE01A',
            animation: 'lp-dot 1s ease-in-out infinite',
            animationDelay: `${delay}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes lp-dot {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  )
}

// ─── NFC Icon ─────────────────────────────────────────────────────────────────

function NfcIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 10c0-3.31 2.69-6 6-6M7 10c0-1.65 1.35-3 3-3"
        stroke="#0a0a0a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="10" r="1.8" fill="#0a0a0a" />
    </svg>
  )
}

// ─── Convenience hooks ────────────────────────────────────────────────────────

/**
 * useLoaderLabel — returns the right label string for each app context
 *
 * Usage:
 *   const label = useLoaderLabel('nfc')
 *   <LocalPulseLoader variant="full" label={label} />
 */
export type LoaderContext =
  | 'nfc'        // NFC tap / node ignite
  | 'hub'        // Hub feed loading
  | 'broadcast'  // Signal / broadcast fetch
  | 'vibe'       // Vibe check fetch
  | 'auth'       // Login / auth flow
  | 'map'        // Map view loading

export function useLoaderLabel(context: LoaderContext): FullLoaderLabel {
  const map: Record<LoaderContext, FullLoaderLabel> = {
    nfc:       'Igniting node',
    hub:       'Scanning city',
    broadcast: 'Tuning signal',
    vibe:      'Checking vibe',
    auth:      'Authenticating',
    map:       'Loading hub',
  }
  return map[context]
}
