import React, { useState, useEffect, useMemo } from 'react';
import { Broadcast, Partner, Node, Sponsor, UserProfile, LocalHub } from '../types';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { getDistance } from '../utils/geo';
import { getTimeLabel, getRecurringTimeLabel } from '../utils/timeUtils';

interface FeedProps {
  broadcasts: Broadcast[];
  currentNode: Node | null;
  onSelect: (broadcast: Broadcast) => void;
  onConfirm?: (id: string) => void;
  onShareEvent: (broadcast: Broadcast) => void;
  onManage?: (broadcast: Broadcast) => void;
  partnersMap: Record<string, Partner>;
  sponsorsMap: Record<string, Sponsor>;
  hideOtherSections?: boolean;
  userProfile?: UserProfile | null;
  localHubs?: LocalHub[];
  onRedeemHub?: (hub: LocalHub) => void;
  loading?: boolean;
}

export const Feed: React.FC<FeedProps> = ({
  broadcasts = [],
  currentNode,
  onSelect,
  partnersMap = {},
  localHubs = [],
  onRedeemHub,
  loading = false,
}) => {
  // Single accent color used sparingly throughout the screen
  const accentColor = currentNode?.partner_accent || '#FFE01A';

  // Live timestamp that updates every 30 seconds
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Track expanded state for sections when "See all" is tapped
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Distance helper
  const getDistanceMeta = (item: { latitude?: number; longitude?: number }) => {
    if (!currentNode || !item.latitude || !item.longitude) {
      return { miles: '0.2 mi', walkMin: 4 };
    }
    const meters = getDistance(
      currentNode.latitude,
      currentNode.longitude,
      item.latitude,
      item.longitude
    );
    const miles = (meters / 1609.34).toFixed(1);
    const walkMin = Math.max(1, Math.round((meters * 1.3) / 80));
    return { miles: `${miles} mi`, walkMin };
  };

  // Location label extractor (no redundant labels)
  const getLocationLabel = (item: Broadcast): string => {
    if (item.venue?.trim()) return item.venue.trim();
    if (item.address?.trim()) {
      const street = item.address.split(',')[0]?.trim() || '';
      const words = street.split(' ');
      const startsWithNumber = !isNaN(Number(words[0]));
      const name = startsWithNumber ? words.slice(1).join(' ') : street;
      return name.length > 20 ? name.slice(0, 18) + '…' : name;
    }
    return 'Over-the-Rhine';
  };

  // Time label extractor (no redundant labels)
  const getTimeStr = (item: Broadcast): string => {
    if (item.is_recurring) {
      return getRecurringTimeLabel(item) || 'Weekly';
    }
    const now = Date.now();
    const start = item.starts_at || item.startsAt ? new Date(item.starts_at || item.startsAt).getTime() : 0;
    const end = item.expires_at || item.expiresAt ? new Date(item.expires_at || item.expiresAt).getTime() : 0;
    if (start && end && now >= start && now <= end) {
      return 'NOW';
    }
    if (start && !isNaN(start)) {
      const d = new Date(start);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return getTimeLabel(item.starts_at, item.expires_at, item.type) || 'Today';
  };

  // Categorize broadcasts
  const flashDeals = useMemo(() => {
    return broadcasts.filter((b) => {
      const type = (b.type ?? '').toLowerCase();
      return type === 'flash_deal' || b.is_sponsored === true;
    });
  }, [broadcasts]);

  const walkingEvents = useMemo(() => {
    return broadcasts.filter((b) => {
      const type = (b.type ?? '').toLowerCase();
      return type === 'walking_event';
    });
  }, [broadcasts]);

  const cityPulse = useMemo(() => {
    return broadcasts.filter((b) => {
      const type = (b.type ?? '').toLowerCase();
      return ['live_event', 'pop_up', 'civic_event', 'civic_free', 'event', 'conference_panel', 'live_performance'].includes(type);
    });
  }, [broadcasts]);

  const foodTrucks = useMemo(() => {
    return broadcasts.filter((b) => (b.type ?? '').toLowerCase() === 'food_truck');
  }, [broadcasts]);

  // Loading Skeleton
  if (loading && broadcasts.length === 0) {
    return (
      <div className="w-full max-w-[520px] mx-auto px-[clamp(1rem,4vw,1.5rem)] pt-[clamp(1.25rem,3.5vw,2rem)] pb-24 flex flex-col gap-8 animate-pulse text-white">
        {/* Top Minimal Row Skeleton */}
        <div className="flex items-center justify-between pb-1">
          <div className="h-8 w-28 bg-[#161618] rounded-lg" />
          <div className="h-7 w-24 bg-[#161618] rounded-full" />
        </div>
        {/* Section Skeletons */}
        {[1, 2].map((s) => (
          <div key={s} className="flex flex-col gap-3">
            <div className="h-4 w-36 bg-[#161618] rounded" />
            <div className="flex gap-3 overflow-hidden">
              <div className="w-[75vw] max-w-[320px] h-56 bg-[#161618] rounded-2xl shrink-0" />
              <div className="w-[75vw] max-w-[320px] h-56 bg-[#161618] rounded-2xl shrink-0" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Left-aligned Section Header component
  const SectionHeader = ({
    label,
    count,
    sectionKey,
  }: {
    label: string;
    count: number;
    sectionKey: string;
  }) => {
    const isExpanded = expandedSections[sectionKey];
    return (
      <div className="flex items-center gap-2 text-left mb-3">
        <h2 className="text-xs font-black tracking-widest text-[#A3A3AA] uppercase">
          {label}
        </h2>
        <span className="text-xs font-mono font-bold text-white/50">
          [{count}]
        </span>
        {count > 2 && (
          <>
            <span className="text-white/20 text-xs">·</span>
            <button
              type="button"
              onClick={() => toggleSection(sectionKey)}
              className="text-xs font-bold hover:underline cursor-pointer min-h-[44px] inline-flex items-center transition-colors"
              style={{ color: accentColor }}
            >
              {isExpanded ? 'Show less' : 'See all'}
            </button>
          </>
        )}
      </div>
    );
  };

  // Consistent Card Component for horizontal carousels
  const ContentCard: React.FC<{
    item: Broadcast;
    badgeLabel?: string;
    ctaLabel: string;
  }> = ({ item, badgeLabel, ctaLabel }) => {
    const partner = partnersMap[item.partnerId || item.partner_id || ''];
    const sponsorLine = partner?.name || item.sponsor_name || item.partner_name || item.venue || 'Urban Hikers';
    const locationLabel = getLocationLabel(item);
    const timeLabel = getTimeStr(item);
    const { miles: distanceLabel } = getDistanceMeta(item);
    const imageUrl = item.cover_url || item.imageUrl;

    return (
      <div
        onClick={() => onSelect(item)}
        className="w-[clamp(260px,76vw,340px)] shrink-0 snap-start bg-[#161618] border border-[#26262A] rounded-2xl overflow-hidden flex flex-col justify-between hover:border-white/20 transition-all cursor-pointer group shadow-lg"
      >
        {/* Image / Gradient Header */}
        <div className="h-32 sm:h-36 relative overflow-hidden bg-gradient-to-br from-[#26262A] to-[#161618]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#2a2a30] via-[#1c1c20] to-[#161618]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#161618] via-black/30 to-black/50" />

          {/* Badges in Header */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center gap-1.5 z-10 pointer-events-none">
            {item.is_sponsored && (
              <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-sm border border-white/10 text-[9.5px] font-black text-white uppercase tracking-wider">
                Sponsored
              </span>
            )}
            {item.is_recurring && (
              <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-sm border border-white/10 text-[9.5px] font-black text-white uppercase tracking-wider">
                Weekly
              </span>
            )}
            {item.payment_type === 'free' && (
              <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-sm border border-white/10 text-[9.5px] font-black text-white uppercase tracking-wider">
                Free
              </span>
            )}
            {badgeLabel && !item.is_sponsored && (
              <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-sm border border-white/10 text-[9.5px] font-black text-white uppercase tracking-wider">
                {badgeLabel}
              </span>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
          <div className="flex flex-col">
            <h3 className="text-base font-bold text-white line-clamp-2 leading-snug group-hover:text-white/90">
              {item.title}
            </h3>
            <p className="text-xs text-[#A3A3AA] truncate font-medium mt-1">
              {sponsorLine}
            </p>
          </div>

          {/* Single Meta Row (location · time · distance) — No redundant labels */}
          <div className="flex items-center gap-1.5 text-xs text-[#A3A3AA] font-medium pt-2 border-t border-[#26262A]">
            <span className="truncate max-w-[130px] text-white/90 font-medium">{locationLabel}</span>
            <span className="text-white/20">·</span>
            <span className="shrink-0">{timeLabel}</span>
            <span className="text-white/20">·</span>
            <span className="shrink-0 font-semibold" style={{ color: accentColor }}>
              {distanceLabel}
            </span>
          </div>

          {/* CTA Button (44px min height touch target) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item);
            }}
            className="w-full min-h-[44px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm mt-1"
            style={{ backgroundColor: accentColor, color: '#000000' }}
          >
            <span>{ctaLabel}</span>
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[520px] mx-auto px-[clamp(1rem,4vw,1.5rem)] pt-[clamp(1.25rem,3.5vw,2rem)] pb-28 flex flex-col gap-[clamp(1.5rem,4vw,2.25rem)] text-white">
      {/* 1. SINGLE, MINIMAL TOP ROW: Title + Small Live-Status Chip */}
      <div className="flex items-center justify-between pb-1">
        <h1 className="text-[clamp(1.75rem,5vw,2.25rem)] font-extrabold tracking-tight text-white leading-none">
          Pulse
        </h1>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 shrink-0">
          <span
            className="w-2 h-2 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-xs font-mono font-semibold text-[#A3A3AA] tabular-nums">
            {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* 2. HOT DEALS SECTION */}
      {flashDeals.length > 0 && (
        <section className="flex flex-col">
          <SectionHeader
            label="HOT DEALS"
            count={flashDeals.length}
            sectionKey="hot_deals"
          />
          <div
            className="flex overflow-x-auto snap-x snap-mandatory gap-3.5 pb-2 pt-0.5 -mx-[clamp(1rem,4vw,1.5rem)] px-[clamp(1rem,4vw,1.5rem)] scrollbar-none"
            style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}
          >
            {(expandedSections['hot_deals'] ? flashDeals : flashDeals.slice(0, 8)).map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                badgeLabel="Deal"
                ctaLabel="Claim Deal"
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. JOIN A WALK SECTION */}
      {walkingEvents.length > 0 && (
        <section className="flex flex-col">
          <SectionHeader
            label="JOIN A WALK"
            count={walkingEvents.length}
            sectionKey="walks"
          />
          <div
            className="flex overflow-x-auto snap-x snap-mandatory gap-3.5 pb-2 pt-0.5 -mx-[clamp(1rem,4vw,1.5rem)] px-[clamp(1rem,4vw,1.5rem)] scrollbar-none"
            style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}
          >
            {(expandedSections['walks'] ? walkingEvents : walkingEvents.slice(0, 8)).map((walk) => (
              <ContentCard
                key={walk.id}
                item={walk}
                badgeLabel="Walk"
                ctaLabel="Join Walk"
              />
            ))}
          </div>
        </section>
      )}

      {/* 4. CITY PULSE: Clean Vertical List (Timestamp + One Line Each) */}
      {cityPulse.length > 0 && (
        <section className="flex flex-col">
          <SectionHeader
            label="CITY PULSE"
            count={cityPulse.length}
            sectionKey="city_pulse"
          />
          <div className="bg-[#161618] border border-[#26262A] rounded-2xl divide-y divide-[#26262A] overflow-hidden shadow-lg">
            {(expandedSections['city_pulse'] ? cityPulse : cityPulse.slice(0, 5)).map((event) => {
              const timeStr = getTimeStr(event);
              const isLive = timeStr === 'NOW';
              const { miles: distanceLabel } = getDistanceMeta(event);
              const venue = event.venue || (event.address ? event.address.split(',')[0] : '');

              return (
                <div
                  key={event.id}
                  onClick={() => onSelect(event)}
                  className="min-h-[48px] px-3.5 py-3 flex items-center gap-3 hover:bg-white/[0.04] transition-colors cursor-pointer group"
                >
                  {/* Timestamp */}
                  <div className="shrink-0 w-16">
                    {isLive ? (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider inline-block text-black"
                        style={{ backgroundColor: accentColor }}
                      >
                        NOW
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-medium text-[#A3A3AA] tabular-nums">
                        {timeStr}
                      </span>
                    )}
                  </div>

                  {/* One Line: Title + Venue */}
                  <div className="flex-1 min-w-0 flex items-baseline gap-1.5 text-sm">
                    <span className="font-semibold text-white truncate group-hover:text-white/90">
                      {event.title}
                    </span>
                    {venue && (
                      <span className="text-xs text-[#A3A3AA] truncate hidden sm:inline">
                        · {venue}
                      </span>
                    )}
                  </div>

                  {/* Distance in Single Accent Color */}
                  <span
                    className="text-xs font-mono font-semibold shrink-0"
                    style={{ color: accentColor }}
                  >
                    {distanceLabel}
                  </span>

                  {/* Arrow Indicator */}
                  <ChevronRight
                    size={16}
                    className="text-[#A3A3AA] group-hover:translate-x-0.5 group-hover:text-white transition-all shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. LOCAL HUBS (If Available) */}
      {localHubs.length > 0 && (
        <section className="flex flex-col">
          <SectionHeader
            label="REFUEL HUBS"
            count={localHubs.length}
            sectionKey="refuel_hubs"
          />
          <div
            className="flex overflow-x-auto snap-x snap-mandatory gap-3.5 pb-2 pt-0.5 -mx-[clamp(1rem,4vw,1.5rem)] px-[clamp(1rem,4vw,1.5rem)] scrollbar-none"
            style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}
          >
            {localHubs.map((hub) => (
              <div
                key={hub.id}
                onClick={() => onRedeemHub?.(hub)}
                className="w-[clamp(260px,76vw,340px)] shrink-0 snap-start bg-[#161618] border border-[#26262A] rounded-2xl overflow-hidden flex flex-col justify-between hover:border-white/20 transition-all cursor-pointer group shadow-lg"
              >
                <div className="h-28 relative overflow-hidden bg-gradient-to-br from-[#26262A] to-[#161618]">
                  {hub.cover_url ? (
                    <img
                      src={hub.cover_url}
                      alt={hub.name}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#2a2a30] to-[#161618]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#161618] via-transparent to-black/40" />
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-sm border border-white/10 text-[9.5px] font-black text-white uppercase tracking-wider">
                      Refuel
                    </span>
                  </div>
                </div>

                <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
                  <div className="flex flex-col">
                    <h3 className="text-base font-bold text-white line-clamp-1 leading-snug">
                      {hub.name}
                    </h3>
                    <p className="text-xs text-[#A3A3AA] truncate font-medium mt-1">
                      {hub.offer || 'Local Partner Hub'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#A3A3AA] font-medium pt-2 border-t border-[#26262A]">
                    <span className="truncate max-w-[130px] text-white/90">
                      {hub.address ? hub.address.split(',')[0] : 'Over-the-Rhine'}
                    </span>
                    <span className="text-white/20">·</span>
                    <span className="shrink-0">{hub.is_open ? 'Open now' : 'Open daily'}</span>
                    <span className="text-white/20">·</span>
                    <span className="shrink-0 font-semibold" style={{ color: accentColor }}>
                      {hub.distance_mi != null ? `${hub.distance_mi} mi` : '0.2 mi'}
                    </span>
                  </div>

                  {hub.cta_url && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRedeemHub?.(hub);
                      }}
                      className="w-full min-h-[44px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm mt-1"
                      style={{ backgroundColor: accentColor, color: '#000000' }}
                    >
                      <span>Claim Offer</span>
                      <ArrowRight size={13} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. FOOD TRUCKS (If Available) */}
      {foodTrucks.length > 0 && (
        <section className="flex flex-col">
          <SectionHeader
            label="FOOD TRUCKS"
            count={foodTrucks.length}
            sectionKey="food_trucks"
          />
          <div
            className="flex overflow-x-auto snap-x snap-mandatory gap-3.5 pb-2 pt-0.5 -mx-[clamp(1rem,4vw,1.5rem)] px-[clamp(1rem,4vw,1.5rem)] scrollbar-none"
            style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}
          >
            {foodTrucks.map((truck) => (
              <ContentCard
                key={truck.id}
                item={truck}
                badgeLabel="Food"
                ctaLabel="View Menu"
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State when no broadcasts exist */}
      {flashDeals.length === 0 && walkingEvents.length === 0 && cityPulse.length === 0 && (
        <div className="bg-[#161618] border border-[#26262A] rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-2">
          <p className="text-sm font-semibold text-white">
            No live broadcasts in this radius right now
          </p>
          <p className="text-xs text-[#A3A3AA]">
            Check back soon as events and flash drops appear throughout the day.
          </p>
        </div>
      )}
    </div>
  );
};
