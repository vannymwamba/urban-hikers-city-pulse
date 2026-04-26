import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  doc, getDoc,
  collection, addDoc, increment,
  updateDoc, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { toMs, getTimeState, getTimeLabel } from '../utils/timeUtils';
import { BroadcastType } from '../types';
import type { Broadcast } from '../types';

export function SignalPage() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [countdown, setCountdown] = useState('');
  const [copied,    setCopied]    = useState(false);
  const [tick,      setTick]      = useState(0);

  // Load broadcast
  useEffect(() => {
    if (!broadcastId) return;
    getDoc(doc(db, 'broadcasts', broadcastId)).then(snap => {
      if (!snap.exists()) {
        setNotFound(true);
      } else {
        const data = snap.data();
        setBroadcast({ id: snap.id, ...data } as Broadcast);
        // Log impression
        addDoc(collection(db, 'impressions'), {
          broadcast_id: broadcastId,
          event:        'signal_page_view',
          source:       'public_link',
          ts:           Timestamp.now(),
        }).catch(err => console.error("Error logging impression:", err));
        
        updateDoc(doc(db, 'broadcasts', broadcastId), {
          impressions: increment(1)
        }).catch(err => console.error("Error updating impressions:", err));
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error fetching broadcast:", err);
      setLoading(false);
      setNotFound(true);
    });
  }, [broadcastId]);

  // Live countdown ticker
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Compute countdown string
  useEffect(() => {
    if (!broadcast?.expires_at) return;
    const end = toMs(broadcast.expires_at);
    if (!end) return;
    const diff = end - Date.now();
    if (diff <= 0) { setCountdown('Expired'); return; }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    setCountdown(
      h > 0
        ? `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
        : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    );
  }, [tick, broadcast]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: broadcast?.title || 'Local Pulse Signal',
        text:  `Check this out on LocalPulse: ${broadcast?.title}`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCTA = () => {
    if (broadcast?.booking_url && broadcastId) {
      // Log tap
      updateDoc(doc(db, 'broadcasts', broadcastId), {
        taps: increment(1)
      }).catch(err => console.error("Error updating taps:", err));
      
      addDoc(collection(db, 'impressions'), {
        broadcast_id: broadcastId,
        event:        'cta_tap',
        source:       'public_link',
        ts:           Timestamp.now(),
      }).catch(err => console.error("Error logging tap impression:", err));
      
      window.open(broadcast.booking_url, '_blank', 'noopener');
    }
  };

  if (loading) return <SignalPageSkeleton />;
  if (notFound || !broadcast) return <SignalNotFound />;

  const state     = getTimeState(broadcast.starts_at, broadcast.expires_at);
  const timeLabel = getTimeLabel(broadcast.starts_at, broadcast.expires_at, broadcast.type);
  const isExpired = state === null;
  const isLive    = state === 'live';

  const locationShort = broadcast.venue
    || broadcast.address?.split(',')[0]?.trim()
    || 'Nearby';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      fontFamily: "'Space Mono', monospace",
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 480,
      margin: '0 auto',
    }}>

      {/* Cover image */}
      <div style={{
        height: 280,
        position: 'relative',
        background: '#111',
        overflow: 'hidden',
      }}>
        {broadcast.cover_url && (
          <img
            src={broadcast.cover_url}
            alt={broadcast.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)'
        }} />

        {/* Pills */}
        <div style={{
          position: 'absolute', top: 14, left: 14,
          display: 'flex', gap: 6
        }}>
          {isLive && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: '#E24B4A', borderRadius: 20,
              padding: '5px 11px',
              fontSize: 8, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#fff',
                animation: 'blink 1.2s infinite',
              }} />
              Live Now
            </div>
          )}
          {broadcast.type && (
            <div style={{
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              borderRadius: 20, padding: '5px 11px',
              fontSize: 8, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#fff',
            }}>
              {getCategoryLabel(broadcast.type)}
            </div>
          )}
        </div>

        {/* Share button */}
        <button
          onClick={handleShare}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
              stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round">
              <path d="M4 10l4 4 8-8"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
              stroke="rgba(255,255,255,0.9)" strokeWidth="2">
              <circle cx="15" cy="4" r="2"/><circle cx="5" cy="10" r="2"/>
              <circle cx="15" cy="16" r="2"/>
              <path d="M7 11l6 4M13 5L7 9"/>
            </svg>
          )}
        </button>

        {/* Title */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
          <div style={{
            fontSize: 20, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.01em',
            lineHeight: 1.2, marginBottom: 4,
          }}>
            {broadcast.title}
          </div>
          {broadcast.partner_name && (
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {broadcast.is_sponsored ? `Sponsored by ${broadcast.partner_name}` : broadcast.partner_name}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>

        {/* Countdown */}
        {!isExpired && (
          <div style={{
            background: '#1a1a0a',
            border: `0.5px solid ${isLive ? '#E24B4A' : '#FFE01A'}`,
            borderRadius: 10, padding: '12px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{
                fontSize: 7, letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: isLive ? '#E24B4A' : '#444',
                marginBottom: 4,
              }}>
                {isLive ? 'Signal ends in' : 'Signal starts in'}
              </div>
              <div style={{
                fontSize: 22, fontWeight: 700,
                color: isLive ? '#E24B4A' : '#FFE01A',
                letterSpacing: '0.04em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {countdown}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, color: '#555', letterSpacing: '0.06em' }}>
                {locationShort}
              </div>
              {broadcast.taps && (
                <div style={{
                  fontSize: 8, color: '#1D9E75', marginTop: 4,
                  letterSpacing: '0.06em',
                }}>
                  {broadcast.taps} people tapped this
                </div>
              )}
            </div>
          </div>
        )}

        {/* Location + time */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { icon: '📍', text: `${locationShort}${broadcast.address ? ` · ${broadcast.address.split(',')[0]}` : ''}` },
            { icon: '🕐', text: timeLabel || 'Time TBD' },
            broadcast.description && { icon: '💬', text: broadcast.description.slice(0, 120) + (broadcast.description.length > 120 ? '...' : '') },
          ].filter(Boolean).map((item: any, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              fontSize: 9, color: '#666', letterSpacing: '0.04em',
              lineHeight: 1.5,
            }}>
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        {broadcast.booking_url && !isExpired && (
          <button
            onClick={handleCTA}
            style={{
              width: '100%', padding: 14,
              background: '#FFE01A', color: '#0a0a0a',
              border: 'none', borderRadius: 10,
              fontFamily: "'Space Mono', monospace",
              fontSize: 10, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {broadcast.type === BroadcastType.WALKING_EVENT ? 'Book Now ↗' :
             broadcast.type === BroadcastType.FLASH_DEAL    ? 'Claim Deal ↗' :
             broadcast.type === BroadcastType.DONATION      ? 'Donate ♥' :
             'View Details ↗'}
          </button>
        )}

        {isExpired && (
          <div style={{
            textAlign: 'center', padding: 16,
            fontSize: 9, color: '#333',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            This signal has expired
          </div>
        )}

        {/* Share to friend */}
        <button
          onClick={handleShare}
          style={{
            width: '100%', padding: 12,
            background: 'transparent', color: '#555',
            border: '0.5px solid #1e1e1e', borderRadius: 10,
            fontFamily: "'Space Mono', monospace",
            fontSize: 9, letterSpacing: '0.12em',
            textTransform: 'uppercase', cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none"
            stroke="currentColor" strokeWidth="2">
            <circle cx="15" cy="4" r="2"/><circle cx="5" cy="10" r="2"/>
            <circle cx="15" cy="16" r="2"/>
            <path d="M7 11l6 4M13 5L7 9"/>
          </svg>
          {copied ? 'Link copied!' : 'Send this signal to a friend'}
        </button>

        {/* Brand footer */}
        <div style={{ textAlign: 'center', paddingTop: 8, marginTop: 'auto' }}>
          <div style={{ fontSize: 7, color: '#1e1e1e', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Powered by
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
            Local<span style={{ color: '#FFE01A' }}>Pulse</span> · Urban Hikers
          </div>
          <div style={{ fontSize: 7, color: '#1a1a1a', marginTop: 4, letterSpacing: '0.1em' }}>
            app.localpulses.com
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
      `}</style>
    </div>
  );
}

function getCategoryLabel(type: string): string {
  const labels: Record<string, string> = {
    live_event:    'Live Performance',
    food_truck:    'Food Truck',
    walking_event: 'Guided Walk',
    flash_deal:    'Flash Deal',
    pop_up:        'Event',
    civic_event:   'Civic Event',
    mural:         'Mural',
    street_art:    'Street Art',
  };
  return labels[type] || type;
}

function SignalPageSkeleton() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      maxWidth: 480, margin: '0 auto',
    }}>
      <div style={{ height: 280, background: '#111', animation: 'pulse 1.5s infinite' }} />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ height: 70, background: '#111', borderRadius: 10 }} />
        <div style={{ height: 20, background: '#111', borderRadius: 4, width: '70%' }} />
        <div style={{ height: 48, background: '#111', borderRadius: 10 }} />
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
    </div>
  );
}

function SignalNotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Space Mono', monospace", color: '#fff',
      gap: 12, padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 32 }}>📡</div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
        Signal not found
      </div>
      <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        This signal may have expired or been removed
      </div>
      <a href="/" style={{
        marginTop: 8, padding: '10px 20px',
        background: '#FFE01A', color: '#0a0a0a',
        fontFamily: "'Space Mono', monospace",
        fontSize: 9, fontWeight: 700,
        letterSpacing: '0.16em', textTransform: 'uppercase',
        textDecoration: 'none', borderRadius: 8,
      }}>
        Open LocalPulse →
      </a>
    </div>
  );
}
