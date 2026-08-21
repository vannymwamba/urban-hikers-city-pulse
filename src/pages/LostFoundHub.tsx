import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Phone, Mail, CheckCircle2, Tag, Search, Loader2, ArrowLeft } from 'lucide-react';

interface LfItem {
  id: string;
  type: 'lost' | 'found';
  description: string;
  contact: string;
  node_id: string;
  reportedAt: any;
  status: string;
  resolveCode?: string;
}

export function LostFoundHub() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<LfItem[]>([]);
  const [artists, setArtists] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch artists once to map IDs to Names
    const fetchArtists = async () => {
      try {
        const snap = await getDocs(collection(db, 'artists'));
        const artistMap: Record<string, string> = {};
        snap.forEach(doc => {
          artistMap[doc.id] = doc.data().artist_name;
        });
        setArtists(artistMap);
      } catch (err) {
        console.error("Failed to fetch artists for hub", err);
      }
    };
    fetchArtists();

    // Listen to live open reports
    const q = query(
      collection(db, 'lost_found'),
      where('status', '==', 'open'),
      orderBy('reportedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const fetched: LfItem[] = [];
      snap.forEach(d => {
        fetched.push({ id: d.id, ...d.data() } as LfItem);
      });
      setReports(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Live feed error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleResolve = async (id: string, resolveCode?: string) => {
    const code = window.prompt("Enter the 6-character resolve code to close this report:");
    if (!code) return;

    if (resolveCode && code.toUpperCase() !== resolveCode.toUpperCase()) {
      alert("Invalid resolve code.");
      return;
    }
    
    setResolvingId(id);
    try {
      await updateDoc(doc(db, 'lost_found', id), {
        status: 'resolved',
        resolved_by_code: code.toUpperCase()
      });
    } catch (err) {
      console.error("Failed to resolve", err);
      alert("Could not resolve report. You might not have permission, or the code was rejected.");
    } finally {
      setResolvingId(null);
    }
  };

  const getContactLink = (contactStr: string) => {
    // Very basic check: if it contains @ it's likely an email, else assume phone
    if (contactStr.includes('@')) {
      return `mailto:${contactStr}`;
    }
    // Clean phone number (remove spaces/dashes for tel: link)
    const cleanedPhone = contactStr.replace(/[^0-9+]/g, '');
    return `tel:${cleanedPhone}`;
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp || !timestamp.toMillis) return 'Recently';
    const mins = Math.floor((Date.now() - timestamp.toMillis()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const filteredReports = reports.filter(r => filter === 'all' || r.type === filter);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#F2C94C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-white p-6 pb-20 md:p-12 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <header className="mb-10">
          <button 
            onClick={() => navigate(-1)}
            className="mb-6 flex items-center gap-2 text-[#8A928B] hover:text-white transition-colors text-sm font-bold uppercase tracking-wider"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Lost & Found Hub</h1>
          <p className="text-[#8A928B] text-sm">Live dashboard of active item reports from all artist nodes.</p>
        </header>

        {/* Filters */}
        <div className="flex gap-3 mb-8">
          <button 
            onClick={() => setFilter('all')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${filter === 'all' ? 'bg-white text-black' : 'bg-[#1A1A1A] text-[#8A928B] hover:bg-[#2A2A2A]'}`}
          >
            All ({reports.length})
          </button>
          <button 
            onClick={() => setFilter('lost')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${filter === 'lost' ? 'bg-[#E24A3B] text-white' : 'bg-[#1A1A1A] text-[#8A928B] hover:bg-[#2A2A2A]'}`}
          >
            <Tag size={14} /> Lost
          </button>
          <button 
            onClick={() => setFilter('found')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${filter === 'found' ? 'bg-[#F2C94C] text-[#0B0B0D]' : 'bg-[#1A1A1A] text-[#8A928B] hover:bg-[#2A2A2A]'}`}
          >
            <Search size={14} /> Found
          </button>
        </div>

        {/* Feed */}
        <div className="flex flex-col gap-4">
          {filteredReports.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
              <p className="text-[#8A928B] font-mono text-sm tracking-widest uppercase">No Active Reports</p>
            </div>
          ) : (
            filteredReports.map(report => {
              const locationName = artists[report.node_id] || "Unknown Node";
              const isLost = report.type === 'lost';
              
              return (
                <div key={report.id} className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                  {/* Card Header */}
                  <div className="p-5 border-b border-white/5 flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-sm ${isLost ? 'bg-[#E24A3B]/20 text-[#E24A3B]' : 'bg-[#F2C94C]/20 text-[#F2C94C]'}`}>
                          {isLost ? 'LOST ITEM' : 'FOUND ITEM'}
                        </span>
                        <span className="text-[#8A928B] text-xs">{formatTime(report.reportedAt)}</span>
                      </div>
                      <h3 className="text-lg font-medium leading-tight">{report.description}</h3>
                      <p className="text-[#8A928B] text-xs font-mono uppercase tracking-wider mt-1">
                        📍 {locationName}
                      </p>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-3 bg-black/20 flex gap-2">
                    <a 
                      href={getContactLink(report.contact)}
                      className="flex-1 bg-white/10 hover:bg-white/15 transition-colors py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold"
                    >
                      {report.contact.includes('@') ? <Mail size={16} /> : <Phone size={16} />}
                      Contact Reporter
                    </a>
                    
                    <button 
                      onClick={() => handleResolve(report.id, report.resolveCode)}
                      disabled={resolvingId === report.id}
                      className="px-6 bg-[#2A2A2A] hover:bg-[#333] transition-colors rounded-xl flex items-center justify-center text-[#8A928B] hover:text-white"
                      title="Mark as Resolved"
                    >
                      {resolvingId === report.id ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={20} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
      </div>
    </div>
  );
}
