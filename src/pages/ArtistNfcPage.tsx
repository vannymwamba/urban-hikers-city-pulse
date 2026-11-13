import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase';
import type { Artist, ArtistSocialProfile, VisitorProfile } from '../types';
import { recordVisitorTapTransaction } from '../utils/visitorProfile';
import { formatNextStepDirections } from '../utils/geo';
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
  Users,
  Eye,
  Compass,
  Navigation,
  Play,
  Pause,
  Volume2
} from 'lucide-react';
import { QuickReportSheet } from '../components/QuickReportSheet';
import { SponsorSlot } from '../components/SponsorSlot';
import { useGlobalSponsors } from '../contexts/GlobalSponsorsContext';
import { PartnerPerkCard } from '../components/PartnerPerkCard';
import { MicroLoopsModal } from '../components/MicroLoopsModal';

// Treat the redirect source (Tapin for NFC, our QR codes for qr) as the
// source of truth: it's set once from the URL the tag/code points to.
function getAccessVectorFromUrl(): 'nfc' | 'qr' | 'direct' {
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref === 'nfc') return 'nfc';
  if (ref === 'qr') return 'qr';
  return 'direct';
}

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

function getObservationCue(artist: Artist): string {
  if (artist.look_up_notice && artist.look_up_notice.trim()) {
    return artist.look_up_notice;
  }
  if (artist.look_up_cue && artist.look_up_cue.trim()) {
    return artist.look_up_cue;
  }
  const cues: Record<string, string> = {
    'jessica-watts': 'Look up and notice the copper leafing along the cheekbones that catches streetlights after sunset.',
    'charlie-harper': 'Look up and notice how minimal geometric strokes form the wings of the cardinal hidden in the cornice.',
    'kyle-holbrook': 'Look up and notice the handprints along the base of the mural—each placed by an Over-The-Rhine youth resident.',
  };
  if (artist.artist_slug && cues[artist.artist_slug]) {
    return cues[artist.artist_slug];
  }
  return 'Look up and notice how the light strikes the upper masonry and the subtle patterns woven into the architectural relief.';
}

/**
 * Lazy audio story player:
 * Strict requirement: Do not load or buffer audio bytes until the visitor taps play.
 * Uses preload="none" and on-demand stream initialization to guarantee sub-2s initial load on weak signals.
 */
function LazyAudioStory({
  audioUrl,
  durationStr = '1:15',
  title
}: {
  audioUrl?: string;
  durationStr?: string;
  title: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasRequestedAudio, setHasRequestedAudio] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const handlePlayPause = () => {
    // Only set audio src when user explicitly taps play
    if (!hasRequestedAudio) {
      setHasRequestedAudio(true);
      const targetSrc = audioUrl || 'https://actions.google.com/sounds/v1/ambiences/outdoor_ambience_distant_city.ogg';
      setAudioSrc(targetSrc);
      return;
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Audio play request failed:', err);
      });
    }
  };

  useEffect(() => {
    if (audioSrc && audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Initial audio playback error:', err);
      });
    }
  }, [audioSrc]);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="none"
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />
      )}

      <button
        type="button"
        onClick={handlePlayPause}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 active:bg-white/15 border border-white/10 text-white transition-all text-xs font-bold uppercase tracking-wider"
      >
        <div className="w-7 h-7 rounded-full bg-[#F2C94C] text-[#0B0B0D] flex items-center justify-center shrink-0">
          {isPlaying ? <Pause size={12} fill="#0B0B0D" /> : <Play size={12} fill="#0B0B0D" className="ml-0.5" />}
        </div>
        <span>{isPlaying ? 'Pause Story' : 'Listen to 60s Story'}</span>
      </button>

      <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#8A928B] tabular-nums">
        <Volume2 size={12} className={isPlaying ? 'text-[#F2C94C] animate-pulse' : 'text-[#8A928B]'} />
        <span>{isPlaying ? formatSeconds(currentTime) : (durationStr || '1:15')}</span>
      </div>
    </div>
  );
}

export function ArtistNfcPage() {
  const { artistSlug } = useParams<{ artistSlug: string }>();
  const navigate = useNavigate();
  const globalSponsors = useGlobalSponsors();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const [isLoopsModalOpen, setIsLoopsModalOpen] = useState(false);
  const [nextArtist, setNextArtist] = useState<Artist | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
  const [openReportsCount, setOpenReportsCount] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAllArtists, setShowAllArtists] = useState(false);
  const [visitorProfile, setVisitorProfile] = useState<VisitorProfile | null>(null);

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

          // Record tap in runTransaction and read visitor profile with one getDoc
          try {
            let currentUid = auth.currentUser?.uid;
            if (!currentUid) {
              const anonRes = await signInAnonymously(auth);
              currentUid = anonRes.user.uid;
            }
            if (currentUid) {
              await recordVisitorTapTransaction(currentUid, {
                artist_id: artistData.id || artistSlug,
                location_id: artistData.location_id || null,
                neighborhood: artistData.neighborhood || null,
                lat: artistData.latitude || null,
                lng: artistData.longitude || null,
                access_vector: getAccessVectorFromUrl(),
              });

              // Read it with one getDoc
              const snap = await getDoc(doc(db, 'visitor_profiles', currentUid));
              if (snap.exists() && isMounted) {
                setVisitorProfile(snap.data() as VisitorProfile);
              }
            }
          } catch (profileErr) {
            console.warn('Could not record or load visitor profile:', profileErr);
          }
          
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

  // Calculate dynamic next step directions & summary
  const nextStepInfo = useMemo(() => {
    if (!artist) return null;
    const fromLat = artist.latitude || 39.1031;
    const fromLon = artist.longitude || -84.5120;
    const toLat = nextArtist?.latitude || (fromLat + 0.0018);
    const toLon = nextArtist?.longitude || fromLon;
    const destName = nextArtist?.artist_name || artist.next_story_name || 'Jessica Watts';

    return formatNextStepDirections(fromLat, fromLon, toLat, toLon, destName);
  }, [artist, nextArtist]);

  // Build normalized list of artists strictly for this profile
  const artistProfiles = useMemo<ArtistSocialProfile[]>(() => {
    if (!artist) return [];

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
                  setIsLoopsModalOpen(true);
                }}
                className="w-full px-4 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-colors flex items-center justify-between border-t border-white/5"
              >
                <span>30-Min Micro-Loops</span>
                <Footprints size={12} className="text-[#F2C94C]" />
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
      <div className="relative w-full h-[36vh] min-h-[260px] z-10 flex flex-col justify-end">
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

      {/* Main Content (Fluid Max-Width Container) */}
      <main className="relative z-20 flex flex-col px-5 max-w-[520px] mx-auto w-full -mt-8">
        
        {/* 1. Fast First Load "YOU ARE HERE" Card */}
        <div className="bg-[#141417] rounded-2xl border border-[#F2C94C]/35 p-5 mb-5 shadow-2xl relative overflow-hidden">
          {/* Subtle top amber highlight */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#F2C94C] to-transparent" />
          
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F2C94C] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F2C94C]"></span>
              </span>
              <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-[#F2C94C] uppercase">
                YOU ARE HERE
              </span>
            </div>
            <span className="font-mono text-[9px] text-[#8A928B] uppercase tracking-wider">
              {artist.nfc_id || 'BLINK 2026 NODE'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight leading-[1] mb-1.5">
            {artist.artwork_title || artist.artist_name}
          </h1>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#F2C94C] font-bold uppercase tracking-wide mb-3">
            <span>By {artist.artist_name}</span>
            {coArtistNames.length > 0 && <span>+ {coArtistNames.join(', ')}</span>}
            {artist.hometown && (
              <>
                <span className="text-white/30">•</span>
                <span className="text-white/80">{artist.hometown}</span>
              </>
            )}
          </div>

          {/* "Look up and notice..." line */}
          <div className="bg-[#1C1C21] border border-white/10 rounded-xl p-3.5 mb-4">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#F2C94C]/15 border border-[#F2C94C]/30 flex items-center justify-center shrink-0 mt-0.5">
                <Eye size={13} className="text-[#F2C94C]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-[9px] font-bold tracking-[0.15em] text-[#F2C94C] uppercase">
                  LOOK UP AND NOTICE...
                </span>
                <p className="text-xs text-white/95 leading-relaxed mt-1 font-medium">
                  {getObservationCue(artist)}
                </p>
              </div>
            </div>
          </div>

          {/* Audio Player: Loads strictly on-demand on user tap (preload="none") */}
          <div className="pt-2 border-t border-white/5">
            <LazyAudioStory 
              audioUrl={artist.audio_url} 
              durationStr={artist.audio_duration_str || "1:15"} 
              title={artist.artist_name}
            />
          </div>
        </div>

        {/* 2. Next-Step Directions & Micro-Loops */}
        <div className="bg-[#161618] rounded-2xl border border-white/10 p-5 mb-5 flex flex-col shadow-lg">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Compass size={14} className="text-[#F2C94C]" />
              <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-[#F2C94C] uppercase">
                NEXT STEP
              </span>
            </div>
            <span className="font-mono text-[9px] text-[#8A928B] uppercase tracking-wider">
              KEEP WALKING
            </span>
          </div>

          {/* Headline: "Next: [name] · 180 yd North · 2 min" */}
          <div className="py-1.5">
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-snug">
              Next: {nextArtist ? nextArtist.artist_name : (artist.next_story_name || "Jessica Watts")} · {nextStepInfo ? nextStepInfo.summary : "180 yd North · 2 min"}
            </h3>
          </div>

          <div className="flex flex-col gap-2.5 mt-3">
            {/* One-Tap Maps Walking Directions */}
            <a
              href={nextStepInfo?.googleMapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextArtist?.location_string || 'Over-the-Rhine, Cincinnati, OH')}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] bg-[#F2C94C] hover:bg-[#d9b33e] text-[#0B0B0D] text-xs font-black uppercase tracking-wider rounded-xl py-3 px-4 flex items-center justify-between transition-colors shadow"
            >
              <span className="flex items-center gap-2">
                <Navigation size={16} />
                <span>One-Tap Walking Directions</span>
              </span>
              <ArrowRight size={16} />
            </a>

            {/* Curated 30-Minute Loops Trigger */}
            <button
              type="button"
              onClick={() => setIsLoopsModalOpen(true)}
              className="w-full min-h-[44px] bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/10 border border-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-xl py-2.5 px-4 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <Footprints size={15} className="text-[#F2C94C]" />
                <span>Urban Hikers 30-Min Micro-Loops</span>
              </span>
              <span className="font-mono text-[10px] text-[#F2C94C] uppercase">3 Routes</span>
            </button>

            {nextArtist && (
              <button
                type="button"
                onClick={() => navigate(`/artist/${nextArtist.artist_slug}`)}
                className="w-full py-1 text-center font-mono text-[10px] text-[#8A928B] hover:text-white uppercase tracking-wider transition-colors"
              >
                Preview Story for {nextArtist.artist_name} →
              </button>
            )}
          </div>

          <div className="mt-3">
            <SponsorSlot variant="wayfinding" sponsor={globalSponsors?.wayfinding} />
          </div>
        </div>

        {/* 3. Partner Perks with Counter-Verifiable Code */}
        <PartnerPerkCard
          tapCount={visitorProfile?.journey_stops?.length || 1}
          userUid={auth.currentUser?.uid}
          partnerName={artist.perk_venue || "Urbana Cafe"}
          partnerAddress={artist.perk_address || "1206 Vine St · Over-The-Rhine (3 min walk)"}
          perkTitle={artist.perk_title || "Refuel Partner Perk"}
          perkDeal={artist.perk_deal || "Free Drip Coffee or $3 Off Any Craft Drink"}
        />

        {/* Location & Multi-Artist Social Roster */}
        <div className="flex flex-col gap-2.5 mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[#F2C94C] shrink-0" />
            <span className="font-bold text-xs tracking-wide uppercase">
              {artist.location_string || "WALNUT ST + 13TH ST • OTR, CINCINNATI"}
            </span>
          </div>
          
          {(artistProfiles.length > 1 || profilesWithInstagram.length > 0) && (
            <>
              <div className="h-[1px] w-full bg-white/10 my-0.5" />

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

        {/* Your Walk So Far Card */}
        <div className="bg-[#141417] rounded-2xl border border-white/10 p-5 mb-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-[#F2C94C] uppercase">
                YOUR WALK SO FAR
              </span>
              <div className="w-6 h-[2px] bg-[#F2C94C] mt-1" />
            </div>
            <span className="font-mono text-[10px] font-bold text-[#8A928B] uppercase tracking-wider">
              BLINK 2026
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center py-3 px-2 bg-white/[0.03] rounded-xl border border-white/5 mb-3">
            <div>
              <div className="text-xl font-black text-white tabular-nums">
                {visitorProfile?.artists_discovered_ids?.length || 1}
              </div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-[#8A928B] mt-0.5">
                Artists
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-white tabular-nums">
                {visitorProfile?.locations_visited_ids?.length || 1}
              </div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-[#8A928B] mt-0.5">
                Locations
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-[#F2C94C] tabular-nums">
                {(visitorProfile?.total_miles_explored || 0).toFixed(1)}
              </div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-[#8A928B] mt-0.5">
                Miles
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-white tabular-nums">
                {visitorProfile?.neighborhoods_visited?.length || 1}
              </div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-[#8A928B] mt-0.5">
                Hoods
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar (Lost & Found) */}
        <div className="mb-6 flex flex-col">
          <button 
            onClick={() => setIsReportSheetOpen(true)}
            className="w-full min-h-[48px] bg-[#F2C94C] hover:bg-[#d9b33e] text-[#0B0B0D] text-sm font-black uppercase tracking-wide py-3.5 rounded-full flex items-center justify-center gap-2 shadow-lg transition-colors relative"
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

      {/* Curated Micro-Loops Sheet */}
      <MicroLoopsModal
        isOpen={isLoopsModalOpen}
        onClose={() => setIsLoopsModalOpen(false)}
        currentLocationName={artist.artwork_title || artist.artist_name}
      />

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
