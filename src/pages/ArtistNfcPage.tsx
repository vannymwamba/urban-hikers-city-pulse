import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Artist, DisplaySponsor } from '../types';
import { 
  ArrowRight, 
  Instagram, 
  Loader2, 
  Share, 
  MoreHorizontal, 
  Play, 
  MapPin, 
  Heart, 
  Footprints,
  Tag
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

export function ArtistNfcPage() {
  const { artistSlug } = useParams<{ artistSlug: string }>();
  const globalSponsors = useGlobalSponsors();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const [nextArtist, setNextArtist] = useState<Artist | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
  const [openReportsCount, setOpenReportsCount] = useState(0);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Discover ${artist?.artist_name}`,
          text: `Check out ${artist?.artist_name}'s story.`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share failed', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  useEffect(() => {
    let unsubscribeReports: () => void;
    
    const fetchArtist = async () => {
      if (!artistSlug) return;
      try {
        const q = query(collection(db, 'artists'), where('artist_slug', '==', artistSlug));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setError('Artist not found');
        } else {
          const artistDoc = querySnapshot.docs[0];
          const artistData = { id: artistDoc.id, ...artistDoc.data() } as Artist;
          setArtist(artistData);
          
          // Setup real-time listener for open reports at this node
          if (artistData.id) {
            const reportsQuery = query(
              collection(db, 'lost_found'),
              where('node_id', '==', artistData.id),
              where('status', '==', 'open')
            );
            unsubscribeReports = onSnapshot(reportsQuery, (snap) => {
              setOpenReportsCount(snap.docs.length);
            });
          }
          
          // Fetch nearest artist
          const allArtistsSnap = await getDocs(collection(db, 'artists'));
          const allArtists = allArtistsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Artist))
            .filter(a => a.id !== artistData.id); // Exclude self
            
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
              setNextArtist(allArtists[0]); // fallback if no coords
            }
          } else if (allArtists.length > 0) {
            setNextArtist(allArtists[0]); // fallback
          }
        }
      } catch (err: any) {
        console.error('Error fetching artist:', err);
        setError('Failed to load artist');
      } finally {
        setLoading(false);
      }
    };
    fetchArtist();
    
    return () => {
      if (unsubscribeReports) unsubscribeReports();
    };
  }, [artistSlug]);

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
        <div className="flex gap-2 pointer-events-auto">
          <button onClick={handleShare} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/60 transition-colors">
            <Share size={18} className="text-white" />
          </button>
          <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/60 transition-colors">
            <MoreHorizontal size={18} className="text-white" />
          </button>
        </div>
      </header>

      {/* Edge-to-Edge Hero Image */}
      <div className="relative w-full h-[38vh] min-h-[280px] z-10 flex flex-col justify-end">
        {artist.cover_art_url ? (
          <div className="absolute inset-0">
            <img 
              src={artist.cover_art_url} 
              alt={`${artist.artist_name} Cover`}
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

        {/* Audio Player Component (Floating on bottom right of image) */}
        <div className="relative z-20 px-5 pb-4 flex justify-end w-full">
          <div className="flex items-center gap-3">
            <button className="w-12 h-12 rounded-full border border-[#F2C94C] flex items-center justify-center bg-black/20 backdrop-blur-md hover:bg-[#F2C94C]/20 transition-colors">
              <Play size={20} fill="#F2C94C" className="text-[#F2C94C] ml-1" />
            </button>
            <div className="flex flex-col">
              {artist.audioSponsor ? (
                <SponsorSlot variant="audio" sponsor={artist.audioSponsor} />
              ) : (
                <span className="font-mono text-[10px] font-bold text-[#F2C94C] tracking-widest uppercase mb-1">
                  HEAR THE ARTIST
                </span>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs text-[#8A928B]">
                  {artist.audio_duration_str || "0:48"}
                </span>
                {/* Mock Waveform */}
                <div className="flex items-end gap-[2px] h-4">
                  {[4, 8, 6, 12, 16, 10, 6, 14, 12, 8, 16, 14, 6, 10, 8, 4, 12, 10].map((h, i) => (
                    <div key={i} className="w-[2px] bg-white/40 rounded-full" style={{ height: `${h}px` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content (Left Aligned) */}
      <main className="relative z-20 flex flex-col px-5 max-w-lg mx-auto w-full mt-0">
        
        {/* Artist Header */}
        <div className="mb-3">
          <div className="flex flex-col mb-1.5">
            <span className="font-mono text-[11px] font-bold tracking-[0.15em] text-[#F2C94C] uppercase">
              ARTIST
            </span>
            <div className="w-8 h-[2px] bg-[#F2C94C] mt-1" />
          </div>
          
          <h1 className="text-4xl font-black text-white uppercase tracking-tight leading-[1] mb-1">
            {artist.artist_name}
          </h1>
          
          {artist.hometown && (
            <div className="font-bold text-white text-sm uppercase tracking-wide mt-1">
              {artist.hometown}
            </div>
          )}
          
          <div className="font-bold text-[#8A928B] text-xs uppercase tracking-wide mt-0.5">
            {artist.artwork_title || "GROWING TOGETHER"} <span className="text-white mx-1">•</span> {artist.artwork_year || "2024"}
          </div>
        </div>

        {/* Metadata Rows */}
        <div className="flex flex-col gap-2 mb-4">
          {/* Location Row */}
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[#F2C94C] shrink-0" />
            <span className="font-bold text-xs tracking-wide">
              {artist.location_string || "WALNUT ST + 13TH ST • OTR, CINCINNATI"}
            </span>
          </div>
          
          <div className="h-[1px] w-full bg-white/10 my-0.5" />

          {/* Instagram Row */}
          <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity">
            <Instagram size={16} className="text-white shrink-0" />
            <span className="font-bold">{artist.instagram_handle || "@" + (artist.artist_slug || artist.artist_name.replace(/\s+/g, '_').toLowerCase())}</span>
            <span className="text-[#8A928B] px-1">|</span>
            <span className="font-bold text-[#8A928B] uppercase tracking-wide">
              {artist.instagram_followers ? `${artist.instagram_followers.toLocaleString()} FOLLOWERS` : '41,238 FOLLOWERS'}
            </span>
          </a>
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
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-[#8A928B] uppercase tracking-wider">
                <Footprints size={12} className="text-[#8A928B]" />
                {distanceToNext ? distanceToNext.toFixed(1) : (artist.next_story_distance_mi || "0.3")} MI <span className="text-white/30">•</span> {distanceToNext ? Math.round(distanceToNext * 20) : (artist.next_story_time_mins || "6")} MIN WALK
              </div>
            </div>
            
            {/* Mock Dotted Map Graphic */}
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
                <polygon points="80,55 85,65 75,65" fill="#white" />
              </svg>
            </div>
          </div>
          
          <div className="flex flex-col mb-3">
            <button className="w-full bg-[#F2C94C] hover:bg-[#d9b33e] text-[#0B0B0D] text-sm font-black uppercase tracking-wide py-3 px-5 flex justify-between items-center transition-colors">
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
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#E24A3B] text-white rounded-full flex items-center justify-center text-[10px] font-bold border-[1.5px] border-[#0B0B0D] animate-in zoom-in duration-300">
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
