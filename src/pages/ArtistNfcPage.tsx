import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Artist, ArtistSocialProfile } from '../types';
import { 
  ArrowRight, 
  Instagram, 
  Loader2, 
  Share, 
  MoreHorizontal, 
  ChevronRight,
  MapPin, 
  Footprints,
  Tag,
  Check,
  Users
} from 'lucide-react';
import { QuickReportSheet } from '../components/QuickReportSheet';
import { SponsorSlot } from '../components/SponsorSlot';
import { useGlobalSponsors } from '../contexts/GlobalSponsorsContext';

function getDistanceFromLatLonInMi(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = (lat2-lat1) * (Math.PI/180);
  const dLon = (lon2-lon1) * (Math.PI/180); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

function getExplicitInstagramData(entry: {
  instagram_handle?: string;
  instagram_url?: string;
  instagram_followers?: number;
}): { handle: string; url: string; followers: number | null } | null {
  const rawUrl = (entry.instagram_url || '').trim();
  const rawHandle = (entry.instagram_handle || '').trim();

  if (!rawUrl && !rawHandle) {
    return null;
  }

  let handle = rawHandle;
  if (!handle && rawUrl) {
    try {
      const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length > 0 && segments[0] !== 'p' && segments[0] !== 'reel') {
        handle = `@${segments[0].replace(/^@/, '')}`;
      }
    } catch {
      handle = rawUrl;
    }
  } else if (handle && !handle.startsWith('@')) {
    handle = `@${handle}`;
  }

  const url = rawUrl
    ? rawUrl.startsWith('http')
      ? rawUrl
      : `https://${rawUrl}`
    : `https://instagram.com/${handle.replace(/^@/, '')}`;

  const followers =
    typeof entry.instagram_followers === 'number' && entry.instagram_followers > 0
      ? entry.instagram_followers
      : null;

  return {
    handle: handle || rawUrl,
    url,
    followers,
  };
}

export function ArtistNfcPage() {
  const { artistSlug } = useParams<{ artistSlug: string }>();
  const navigate = useNavigate();
  const globalSponsors = useGlobalSponsors();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const [nextArtist, setNextArtist] = useState<Artist | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
  const [openReportsCount, setOpenReportsCount] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAllArtists, setShowAllArtists] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Discover ${artist?.artist_name}`,
          text: `Check out ${artist?.artist_name}'s story.`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const fetchArtist = async () => {
      if (!artistSlug) return;
      try {
        const q = query(collection(db, 'artists'), where('artist_slug', '==', artistSlug));
        const querySnapshot = await getDocs(q);
        if (!isMounted) return;
        
        if (querySnapshot.empty) {
          setError('Artist not found');
        } else {
          const artistDoc = querySnapshot.docs[0];
          const artistData = { id: artistDoc.id, ...artistDoc.data() } as Artist;
          setArtist(artistData);
          
          // One-time fetch for open reports at this node
          if (artistData.id) {
            try {
              const reportsQuery = query(
                collection(db, 'lost_found'),
                where('node_id', '==', artistData.id),
                where('status', '==', 'open')
              );
              const reportsSnap = await getDocs(reportsQuery);
              if (isMounted) {
                setOpenReportsCount(reportsSnap.docs.length);
              }
            } catch {
              // Ignore if quota reached or offline
            }
          }
          
          // Fetch nearest artist
          try {
            const allArtistsSnap = await getDocs(collection(db, 'artists'));
            if (!isMounted) return;
            const allArtists = allArtistsSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as Artist))
              .filter(a => a.id !== artistData.id);
              
            if (allArtists.length > 0 && artistData.latitude && artistData.longitude) {
              let minDistance = Infinity;
              let nearest: Artist | null = null;
              
              allArtists.forEach(a => {
                if (a.latitude && a.longitude) {
                  const dist = getDistanceFromLatLonInMi(
                    artistData.latitude!, artistData.longitude!, 
                    a.latitude, a.longitude
                  );
                  if (dist < minDistance) {
                    minDistance = dist;
                    nearest = a;
                  }
                }
              });
              
              if (nearest) {
                setNextArtist(nearest);
                setDistanceToNext(minDistance);
              } else {
                setNextArtist(allArtists[0]);
              }
            } else if (allArtists.length > 0) {
              setNextArtist(allArtists[0]);
            }
          } catch {
            // Ignore secondary query errors
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        const msg = err?.message || String(err);
        if (err?.code === 'resource-exhausted' || msg.includes('Quota limit exceeded') || msg.includes('Quota exceeded')) {
          const formattedName = artistSlug
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          setArtist({
            id: artistSlug,
            artist_name: formattedName,
            artist_slug: artistSlug,
            blink_artist_url: '',
            cover_art_url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1000&q=80',
            nfc_destination: `/artist/${artistSlug}`,
            instagram_url: '',
            instagram_followers: 0,
            nfc_id: `NFC-${artistSlug.toUpperCase()}`,
            instagram_last_updated: new Date().toISOString(),
            nfc_tap_count: 0,
          });
        } else {
          setError('Failed to load artist');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchArtist();
    
    return () => {
      isMounted = false;
    };
  }, [artistSlug]);

  // Build normalized list of artists strictly for this profile (no automatic merging or default Instagram accounts)
  const artistProfiles = useMemo<ArtistSocialProfile[]>(() => {
    if (!artist) return [];

    // 1. If featured_artists array is explicitly stored on this artist document, use only those entries
    if (Array.isArray(artist.featured_artists) && artist.featured_artists.length > 0) {
      return artist.featured_artists
        .filter(entry => (entry.name && entry.name.trim()) || (entry.instagram_handle && entry.instagram_handle.trim()) || (entry.instagram_url && entry.instagram_url.trim()))
        .map((entry, idx) => {
          const ig = getExplicitInstagramData(entry);
          return {
            name: (entry.name || '').trim() || (idx === 0 ? artist.artist_name : `Artist ${idx + 1}`),
            instagram_handle: ig ? ig.handle : '',
            instagram_url: ig ? ig.url : '',
            instagram_followers: ig && ig.followers ? ig.followers : 0,
            hometown: entry.hometown || (idx === 0 ? artist.hometown : undefined),
            role: entry.role,
          };
        });
    }

    // 2. Single artist profile: use only this artist's own fields (leave Instagram blank if not specified)
    const ig = getExplicitInstagramData({
      instagram_handle: artist.instagram_handle,
      instagram_url: artist.instagram_url,
      instagram_followers: artist.instagram_followers,
    });

    return [
      {
        name: artist.artist_name,
        instagram_handle: ig ? ig.handle : '',
        instagram_url: ig ? ig.url : '',
        instagram_followers: ig && ig.followers ? ig.followers : 0,
        hometown: artist.hometown,
      },
    ];
  }, [artist]);

  const profilesWithInstagram = useMemo(
    () => artistProfiles.filter(p => Boolean(p.instagram_handle || p.instagram_url)),
    [artistProfiles]
  );

  const totalFollowers = useMemo(
    () => artistProfiles.reduce((sum, p) => sum + (Number(p.instagram_followers) || 0), 0),
    [artistProfiles]
  );

  const visibleArtistProfiles = showAllArtists ? artistProfiles : artistProfiles.slice(0, 4);

  const coArtistNames = useMemo(() => {
    if (artistProfiles.length <= 1) return [];
    const primaryName = (artist?.artist_name || '').toLowerCase();
    return artistProfiles
      .slice(1)
      .map(p => p.name)
      .filter(name => name && !primaryName.includes(name.toLowerCase()));
  }, [artist, artistProfiles]);

  const handleWalkThere = () => {
    if (nextArtist?.artist_slug) {
      navigate(`/artist/${nextArtist.artist_slug}`);
      return;
    }
    const destination = nextArtist?.location_string || artist?.location_string || 'Over-the-Rhine, Cincinnati, OH';
    window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`;
  };

  const computedNodeSponsor = artist?.nodeSponsor || (artist?.sponsor_name ? { name: artist.sponsor_name, link: artist.sponsor_url || '#', logoUrl: artist.sponsor_logo_url || '' } : undefined);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#F2C94C] animate-spin" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] flex flex-col items-center justify-center p-6">
        <p className="text-[#E24A3B] mb-4">{error || 'Artist not found'}</p>
        <Link to="/" className="text-[#F2C94C] hover:underline">Return Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0B0B0D] flex flex-col w-full text-white font-sans overflow-x-hidden pt-safe relative selection:bg-[#F2C94C]/30 selection:text-white pb-8">
      
      {/* Floating Header */}
      <header className="absolute top-0 left-0 right-0 z-30 pt-4 px-4 sm:pt-6 sm:px-6 flex items-start justify-between pointer-events-none">
        <div className="flex flex-col mt-2 pointer-events-auto">
          {globalSponsors?.hero ? (
            <div className="-mt-3">
              <SponsorSlot variant="hero" sponsor={globalSponsors?.hero} />
            </div>
          ) : (
            <>
              <span className="font-mono text-[10px] tracking-widest uppercase">
                YOU <span className="text-[#F2C94C]">FOUND</span> THIS STORY
              </span>
              <div className="w-8 h-[2px] bg-[#F2C94C] mt-1" />
            </>
          )}
        </div>
        <div className="flex gap-2 pointer-events-auto relative">
          <button
            onClick={handleShare}
            aria-label="Share story"
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/60 transition-colors"
          >
            {copiedLink ? <Check size={18} className="text-[#F2C94C]" /> : <Share size={18} className="text-white" />}
          </button>
          <button
            onClick={() => setShowMoreMenu(prev => !prev)}
            aria-label="More options"
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/60 transition-colors"
          >
            <MoreHorizontal size={18} className="text-white" />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 top-12 w-48 bg-[#141417] border border-white/15 rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden">
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  handleShare();
                }}
                className="w-full px-4 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-colors flex items-center justify-between"
              >
                <span>Copy Story Link</span>
                <Share size={12} className="text-[#F2C94C]" />
              </button>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  setIsReportSheetOpen(true);
                }}
                className="w-full px-4 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-colors flex items-center justify-between border-t border-white/5"
              >
                <span>Lost & Found</span>
                <Tag size={12} className="text-[#F2C94C]" />
              </button>
              <Link
                to="/"
                onClick={() => setShowMoreMenu(false)}
                className="w-full px-4 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-[#8A928B] hover:text-white hover:bg-white/10 transition-colors flex items-center justify-between border-t border-white/5"
              >
                <span>Explore City Map</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Edge-to-Edge Hero Image */}
      <div className="relative w-full h-[38vh] min-h-[280px] z-10 flex flex-col justify-end">
        {artist.cover_art_url ? (
          <div className="absolute inset-0">
            <img 
              src={artist.cover_art_url} 
              alt={`${artist.artist_name} Cover`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            {/* Gradient mask to blend into the dark background */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#6a4fb0] via-[#d4457a] to-[#f2a742]">
             <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/60 to-transparent" />
          </div>
        )}
      </div>

      {/* Main Content (Left Aligned) */}
      <main className="relative z-20 flex flex-col px-5 max-w-lg mx-auto w-full mt-0">
        
        {/* Artist Header */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex flex-col">
              <span className="font-mono text-[11px] font-bold tracking-[0.15em] text-[#F2C94C] uppercase">
                {artistProfiles.length > 1 ? `ARTISTS • ${String(artistProfiles.length).padStart(2, '0')}` : 'ARTIST'}
              </span>
              <div className="w-8 h-[2px] bg-[#F2C94C] mt-1" />
            </div>

            {artistProfiles.length > 1 && totalFollowers > 0 && (
              <span className="font-mono text-[10px] font-bold tracking-widest text-[#8A928B] uppercase tabular-nums">
                {totalFollowers.toLocaleString()} TOTAL FOLLOWERS
              </span>
            )}
          </div>
          
          <h1 className="text-4xl font-black text-white uppercase tracking-tight leading-[1] mb-1">
            {artist.artist_name}
          </h1>

          {coArtistNames.length > 0 && (
            <div className="font-bold text-[#F2C94C] text-xs uppercase tracking-wider mt-1">
              WITH {coArtistNames.join(' • ')}
            </div>
          )}
          
          {artist.hometown && (
            <div className="font-bold text-white text-sm uppercase tracking-wide mt-1">
              {artist.hometown}
            </div>
          )}
          
          {(artist.artwork_title || artist.artwork_year) && (
            <div className="font-bold text-[#8A928B] text-xs uppercase tracking-wide mt-0.5">
              {artist.artwork_title}
              {artist.artwork_title && artist.artwork_year && <span className="text-white mx-1">•</span>}
              {artist.artwork_year}
            </div>
          )}
        </div>

        {/* Metadata & Multi-Artist Instagram Section */}
        <div className="flex flex-col gap-2.5 mb-4">
          {/* Location Row */}
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[#F2C94C] shrink-0" />
            <span className="font-bold text-xs tracking-wide uppercase">
              {artist.location_string || "WALNUT ST + 13TH ST • OTR, CINCINNATI"}
            </span>
          </div>
          
          {(artistProfiles.length > 1 || profilesWithInstagram.length > 0) && (
            <>
              <div className="h-[1px] w-full bg-white/10 my-0.5" />

              {/* Multi-Artist & Instagram Roster */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {profilesWithInstagram.length > 0 ? (
                      <Instagram size={13} className="text-[#F2C94C] shrink-0" />
                    ) : (
                      <Users size={13} className="text-[#F2C94C] shrink-0" />
                    )}
                    <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-[#8A928B] uppercase">
                      {artistProfiles.length > 1
                        ? profilesWithInstagram.length > 0
                          ? 'ARTISTS & INSTAGRAM'
                          : 'FEATURED ARTISTS'
                        : 'INSTAGRAM'}
                    </span>
                  </div>
                  {artistProfiles.length > 1 && (
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[#8A928B] uppercase tabular-nums flex items-center gap-1">
                      <Users size={11} className="text-[#F2C94C]" />
                      {artistProfiles.length} CREATORS
                    </span>
                  )}
                </div>

                <div className="bg-[#141417] border border-white/10 rounded-xl divide-y divide-white/10 overflow-hidden">
                  {visibleArtistProfiles.map((profile, idx) => {
                    const hasInstagram = Boolean(profile.instagram_url || profile.instagram_handle);
                    const rowContent = (
                      <>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 group-hover:border-[#F2C94C]/50 group-hover:bg-[#F2C94C]/10 transition-colors">
                            {hasInstagram ? (
                              <Instagram size={15} className="text-white group-hover:text-[#F2C94C] transition-colors" />
                            ) : (
                              <Users size={15} className="text-[#8A928B]" />
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-black text-xs text-white uppercase tracking-wide truncate">
                                {profile.name}
                              </span>
                              {(profile.role || profile.hometown) && (
                                <>
                                  <span className="text-white/25 text-[10px] shrink-0" aria-hidden="true">•</span>
                                  <span className="font-mono text-[10px] text-[#8A928B] uppercase tracking-wider truncate">
                                    {profile.role || profile.hometown}
                                  </span>
                                </>
                              )}
                            </div>

                            {hasInstagram && (
                              <div className="flex items-center gap-1.5 text-xs mt-0.5 min-w-0">
                                <span className="font-bold text-[#F2C94C] group-hover:underline truncate">
                                  {profile.instagram_handle}
                                </span>
                                {Number(profile.instagram_followers) > 0 && (
                                  <>
                                    <span className="text-[#8A928B] px-0.5 shrink-0">|</span>
                                    <span className="font-bold text-[#8A928B] uppercase tracking-wide tabular-nums shrink-0">
                                      {Number(profile.instagram_followers).toLocaleString()} FOLLOWERS
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {hasInstagram && (
                          <div className="flex items-center gap-1 text-[#8A928B] group-hover:text-[#F2C94C] transition-colors shrink-0">
                            <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        )}
                      </>
                    );

                    return hasInstagram ? (
                      <a
                        key={`${profile.name}-${idx}`}
                        href={profile.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between gap-3 px-3.5 py-2.5 min-h-[50px] hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors"
                      >
                        {rowContent}
                      </a>
                    ) : (
                      <div
                        key={`${profile.name}-${idx}`}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 min-h-[50px]"
                      >
                        {rowContent}
                      </div>
                    );
                  })}

                  {artistProfiles.length > 4 && (
                    <button
                      type="button"
                      onClick={() => setShowAllArtists(prev => !prev)}
                      className="w-full py-2.5 px-3.5 bg-white/[0.02] hover:bg-white/[0.05] text-center font-mono text-[10px] font-bold tracking-[0.15em] text-[#F2C94C] uppercase transition-colors"
                    >
                      {showAllArtists ? 'SHOW FEWER ARTISTS' : `VIEW ALL ${artistProfiles.length} ARTISTS`}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Node Sponsor */}
        <div className="mb-4">
          <SponsorSlot variant="node" sponsor={computedNodeSponsor} />
        </div>

        {/* Keep Walking Card */}
        <div className="bg-[#1A1A1A] rounded-2xl border border-white/10 overflow-hidden mb-5 flex flex-col">
          <div className="p-4 pb-3 flex justify-between">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-[#F2C94C] uppercase mb-2">
                KEEP WALKING
              </span>
              <span className="font-mono text-[10px] font-bold tracking-widest text-[#8A928B] uppercase mb-1">
                NEXT STORY
              </span>
              <h3 className="text-xl font-black text-white uppercase mb-2">
                {nextArtist ? nextArtist.artist_name : (artist.next_story_name || "JESSICA WATTS")}
              </h3>
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-[#8A928B] uppercase tracking-wider tabular-nums">
                <Footprints size={12} className="text-[#8A928B]" />
                {distanceToNext ? distanceToNext.toFixed(1) : (artist.next_story_distance_mi || "0.3")} MI <span className="text-white/30">•</span> {distanceToNext ? Math.round(distanceToNext * 20) : (artist.next_story_time_mins || "6")} MIN WALK
              </div>
            </div>
            
            {/* Dotted Route Graphic */}
            <div className="w-16 h-16 relative flex items-center justify-center mt-2 shrink-0">
              <svg width="100%" height="100%" viewBox="0 0 100 100" className="absolute inset-0">
                <path 
                  d="M20,20 L50,20 L50,60 L80,60" 
                  fill="none" 
                  stroke="#F2C94C" 
                  strokeWidth="2" 
                  strokeDasharray="4 4"
                />
                <circle cx="20" cy="20" r="5" fill="#F2C94C" />
                <polygon points="80,55 85,65 75,65" fill="#FFFFFF" />
              </svg>
            </div>
          </div>
          
          <div className="flex flex-col mb-3">
            <button
              type="button"
              onClick={handleWalkThere}
              className="w-full bg-[#F2C94C] hover:bg-[#d9b33e] text-[#0B0B0D] text-sm font-black uppercase tracking-wide py-3 px-5 flex justify-between items-center transition-colors"
            >
              <span>WALK THERE</span>
              <ArrowRight size={18} />
            </button>
            <SponsorSlot variant="wayfinding" sponsor={globalSponsors?.wayfinding} />
          </div>
        </div>

        {/* Action Bar (Lost & Found) */}
        <div className="mb-6 flex flex-col">
          <button 
            onClick={() => setIsReportSheetOpen(true)}
            className="w-full bg-[#F2C94C] hover:bg-[#d9b33e] text-[#0B0B0D] text-sm font-black uppercase tracking-wide py-3.5 rounded-full flex items-center justify-center gap-2 shadow-lg transition-colors relative"
          >
            {openReportsCount > 0 && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#E24A3B] text-white rounded-full flex items-center justify-center text-[10px] font-bold border-[1.5px] border-[#0B0B0D] animate-in zoom-in duration-300 tabular-nums">
                {openReportsCount}
              </div>
            )}
            <Tag size={18} />
            <span>LOST & FOUND</span>
          </button>
          <SponsorSlot variant="lostFound" sponsor={globalSponsors?.lostAndFound} />
        </div>

        {/* Footer */}
        <footer className="w-full flex flex-col items-center justify-center pb-8 gap-1">
          <div className="flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.15em] text-[#8A928B] uppercase">
            YOU TAP. <span className="text-[#F2C94C]">THE CITY</span> TALKS. <Footprints size={12} className="text-[#8A928B] mb-0.5" />
          </div>
          <SponsorSlot variant="footer" sponsor={globalSponsors?.footer} />
        </footer>
      </main>

      {/* Lightweight Bottom Sheet for L&F */}
      {artist.id && (
        <QuickReportSheet 
          isOpen={isReportSheetOpen} 
          onClose={() => setIsReportSheetOpen(false)} 
          nodeId={artist.id} 
        />
      )}
    </div>
  );
}
