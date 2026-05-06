// components/PartnerHeader.tsx
// Drop this above your existing feed — no other changes needed.
// Usage: <PartnerHeader walks={signatureWalks} />

import React, { useEffect, useRef } from "react";
import { usePartner } from "../hooks/usePartner";

// ── Types ─────────────────────────────────────────────────────────────────
export interface SignatureWalk {
  id: string;
  title: string;
  tag: string;       // e.g. "Featured" | "History" | "BLINK 2026"
  distance: string;  // e.g. "1.4 mi"
  duration: string;  // e.g. "90 min"
  schedule: string;  // e.g. "Sat 10AM"
  featured?: boolean;
  bookingUrl?: string;
  hub_id: string;    // which hub this walk belongs to
  active: boolean;
}

export interface PartnerLogo {
  id: string;
  short_name: string;
  logo_url: string | null;
  logo_initials: string;
}

interface PartnerHeaderProps {
  walks: SignatureWalk[];
  allPartners?: PartnerLogo[]; // other hub partners shown in logo strip
}

// ── Styles ────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  wrapper: {
    fontFamily: "'Courier New', Courier, monospace",
    background: "#0A0A0A",
    borderBottom: "1px solid #1a1a1a",
  },

  // Layer 1 — hotel strip
  hotelStrip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 16px",
    background: "#0d0d0d",
    borderBottom: "1px solid #1a1a1a",
  },
  logoPill: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "#151515",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: "4px 10px",
  },
  logoImg: {
    width: 22,
    height: 22,
    borderRadius: 3,
    objectFit: "cover" as const,
  },
  logoInitials: {
    width: 22,
    height: 22,
    borderRadius: 3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: "#0A0A0A",
  },
  partnerName: {
    fontSize: 10,
    color: "#aaa",
    letterSpacing: 0.5,
    whiteSpace: "nowrap" as const,
  },
  stripLabel: {
    flex: 1,
    fontSize: 8,
    color: "#444",
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  stripRight: {
    fontSize: 9,
    color: "#FFE01A",
    letterSpacing: 0.5,
    cursor: "pointer",
  },

  // Layer 2 — walk band
  walkBand: {
    padding: "10px 16px",
    borderBottom: "1px solid #141414",
  },
  walkBandHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 9,
  },
  walkBandLabel: {
    fontSize: 8,
    color: "#FFE01A",
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  walkBandSub: {
    fontSize: 8,
    color: "#555",
    letterSpacing: 0.5,
  },
  walkScroll: {
    display: "flex",
    gap: 8,
    overflowX: "auto" as const,
    scrollbarWidth: "none" as const,
    paddingBottom: 2,
  },
  walkCard: {
    minWidth: 128,
    maxWidth: 128,
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 8,
    padding: "9px 10px",
    flexShrink: 0,
    cursor: "pointer",
    transition: "border-color 0.2s",
  },
  walkCardFeatured: {
    minWidth: 128,
    maxWidth: 128,
    background: "#111",
    border: "1.5px solid #FFE01A",
    borderRadius: 8,
    padding: "9px 10px",
    flexShrink: 0,
    cursor: "pointer",
  },
  walkTag: {
    fontSize: 7,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    marginBottom: 4,
    color: "#555",
  },
  walkTagFeatured: {
    fontSize: 7,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    marginBottom: 4,
    color: "#FFE01A",
  },
  walkTitle: {
    fontSize: 11,
    color: "#fff",
    fontWeight: 700,
    lineHeight: 1.3,
    marginBottom: 4,
  },
  walkMeta: {
    fontSize: 8,
    color: "#555",
  },

  // Layer 3 — partner logo strip
  partnerStrip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 16px",
    borderBottom: "1px solid #111",
  },
  partnerStripLabel: {
    fontSize: 7,
    color: "#333",
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    whiteSpace: "nowrap" as const,
  },
  partnerLogos: {
    display: "flex",
    gap: 5,
    alignItems: "center",
    flex: 1,
    overflowX: "auto" as const,
    scrollbarWidth: "none" as const,
  },
  partnerBadge: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 8,
    color: "#555",
    letterSpacing: 0.5,
    whiteSpace: "nowrap" as const,
    cursor: "pointer",
    transition: "border-color 0.2s, color 0.2s",
  },
  partnerBadgeActive: {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 8,
    color: "#888",
    letterSpacing: 0.5,
    whiteSpace: "nowrap" as const,
    cursor: "pointer",
  },
};

// ── Component ─────────────────────────────────────────────────────────────
export const PartnerHeader: React.FC<PartnerHeaderProps> = ({ walks, allPartners = [] }) => {
  const { partner, loading } = usePartner();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hide scrollbar on webkit
  useEffect(() => {
    const el = scrollRef.current;
    if (el) (el.style as any).msOverflowStyle = "none";
  }, []);

  // Don't render if no partner and no walks
  if (!partner && walks.length === 0) return null;

  // Merge: tap-source hotel first, then remaining hub partners
  const allLogos: PartnerLogo[] = partner
    ? [partner, ...allPartners.filter((p) => p.id !== partner.id)]
    : allPartners;

  return (
    <div style={s.wrapper}>

      {/* ── LAYER 1: Hotel co-brand strip ── */}
      {partner && !loading && (
        <div style={s.hotelStrip}>
          <div style={s.logoPill}>
            {partner.logo_url ? (
              <img
                src={partner.logo_url}
                alt={partner.short_name}
                style={s.logoImg}
              />
            ) : (
              <div
                style={{
                  ...s.logoInitials,
                  background: partner.accent_color || "#C8A800",
                }}
              >
                {partner.logo_initials}
              </div>
            )}
            <span style={s.partnerName}>{partner.short_name}</span>
          </div>
          <span style={s.stripLabel}>{partner.label}</span>
          <span style={s.stripRight}>
            {partner.hub_id?.toUpperCase()} HUB ↗
          </span>
        </div>
      )}

      {/* ── LAYER 2: Signature walk band ── */}
      {walks.length > 0 && (
        <div style={s.walkBand}>
          <div style={s.walkBandHeader}>
            <span style={s.walkBandLabel}>↳ Signature Walks</span>
            <span style={s.walkBandSub}>by Urban Hikers</span>
          </div>
          <div ref={scrollRef} style={s.walkScroll}>
            {walks.map((walk) => (
              <div
                key={walk.id}
                style={walk.featured ? s.walkCardFeatured : s.walkCard}
                onClick={() =>
                  walk.bookingUrl && window.open(walk.bookingUrl, "_blank")
                }
              >
                <div style={walk.featured ? s.walkTagFeatured : s.walkTag}>
                  {walk.featured ? "★ " : ""}
                  {walk.tag}
                </div>
                <div style={s.walkTitle}>{walk.title}</div>
                <div style={s.walkMeta}>
                  {walk.distance} · {walk.duration} · {walk.schedule}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LAYER 3: Partner logo strip ── */}
      {allLogos.length > 0 && (
        <div style={s.partnerStrip}>
          <span style={s.partnerStripLabel}>Partners</span>
          <div style={s.partnerLogos}>
            {allLogos.map((p, i) => (
              <div
                key={p.id}
                style={i === 0 && partner ? s.partnerBadgeActive : s.partnerBadge}
              >
                {p.short_name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
