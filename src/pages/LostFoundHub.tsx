import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, updateDoc, doc, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Phone, Mail, CheckCircle2, Tag, Search, Loader2, ArrowLeft, X } from 'lucide-react';

interface LfItem {
  id: string;
  type: 'lost' | 'found';
  description: string;
  location?: string;
  contact: string;
  node_id: string;
  reportedAt: any;
  status: string;
  resolveCode?: string;
}

export function LostFoundHub() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<LfItem[]>([]);
  const [locationLabels, setLocationLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [promptingId, setPromptingId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchLocationNames = useCallback(async () => {
    const map: Record<string, string> = {};
    try {
      const [artistsSnap, nodesSnap] = await Promise.all([
        getDocs(collection(db, 'artists')).catch(() => null),
        getDocs(collection(db, 'nodes')).catch(() => null),
      ]);
      artistsSnap?.forEach((d) => {
        const name = d.data().artist_name;
        if (name) map[d.id] = name;
      });
      nodesSnap?.forEach((d) => {
        const name = d.data().name;
        if (name) map[d.id] = name;
      });
      setLocationLabels(map);
    } catch {
      // Ignore if quota reached
    }
  }, []);

  useEffect(() => {
    fetchLocationNames();

    const q = query(
      collection(db, 'lost_found'),
      where('status', '==', 'open'),
      orderBy('reportedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const fetched: LfItem[] = [];
        snap.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as LfItem);
        });
        setReports(fetched);
        setLoading(false);
      },
      () => {
        // Fallback if composite index on status + reportedAt isn't built yet
        const fallbackQ = query(collection(db, 'lost_found'), orderBy('reportedAt', 'desc'));
        getDocs(fallbackQ)
          .then((snap) => {
            const fetched: LfItem[] = [];
            snap.forEach((d) => {
              const data = d.data();
              if (data.status === 'open') {
                fetched.push({ id: d.id, ...data } as LfItem);
              }
            });
            setReports(fetched);
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    );

    return () => unsubscribe();
  }, [fetchLocationNames]);

  const handleConfirmResolve = async (report: LfItem) => {
    const cleaned = codeInput.trim().toUpperCase();
    if (!cleaned) {
      setResolveError('Enter the 6-character resolve code.');
      return;
    }

    if (report.resolveCode && cleaned !== report.resolveCode.toUpperCase()) {
      setResolveError('Invalid resolve code. Check the code saved when posting.');
      return;
    }

    setResolvingId(report.id);
    setResolveError(null);
    try {
      await updateDoc(doc(db, 'lost_found', report.id), {
        status: 'resolved',
        resolved_by_code: cleaned,
      });
      setReports((prev) => prev.filter((item) => item.id !== report.id));
      setPromptingId(null);
      setCodeInput('');
    } catch (err) {
      console.error('Failed to resolve', err);
      setResolveError('Could not resolve report. Verify the resolve code and try again.');
    } finally {
      setResolvingId(null);
    }
  };

  const getContactLink = (contactStr: string) => {
    if (contactStr.includes('@')) {
      return `mailto:${contactStr}`;
    }
    const cleanedPhone = contactStr.replace(/[^0-9+]/g, '');
    return `tel:${cleanedPhone}`;
  };

  const formatTime = (timestamp: any) => {
    const ms =
      typeof timestamp?.toMillis === 'function'
        ? timestamp.toMillis()
        : typeof timestamp?.toDate === 'function'
          ? timestamp.toDate().getTime()
          : timestamp
            ? new Date(timestamp).getTime()
            : NaN;
    if (!Number.isFinite(ms)) return 'Just now';
    const mins = Math.max(0, Math.floor((Date.now() - ms) / 60000));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const filteredReports = reports.filter((r) => filter === 'all' || r.type === filter);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#F2C94C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-white p-6 pb-24 md:p-12 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="mb-10 pr-14">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 flex items-center gap-2 text-[#8A928B] hover:text-white transition-colors text-sm font-bold uppercase tracking-wider"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Lost &amp; Found Hub</h1>
          <p className="text-[#8A928B] text-sm">
            Live dashboard of active item reports across community hubs and artist stops.
          </p>
        </header>

        {/* Filters */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setFilter('all')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              filter === 'all' ? 'bg-white text-black' : 'bg-[#1A1A1A] text-[#8A928B] hover:bg-[#2A2A2A]'
            }`}
          >
            All ({reports.length})
          </button>
          <button
            onClick={() => setFilter('lost')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              filter === 'lost' ? 'bg-[#E24A3B] text-white' : 'bg-[#1A1A1A] text-[#8A928B] hover:bg-[#2A2A2A]'
            }`}
          >
            <Tag size={14} /> Lost
          </button>
          <button
            onClick={() => setFilter('found')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              filter === 'found' ? 'bg-[#F2C94C] text-[#0B0B0D]' : 'bg-[#1A1A1A] text-[#8A928B] hover:bg-[#2A2A2A]'
            }`}
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
            filteredReports.map((report) => {
              const locationName =
                locationLabels[report.node_id] ||
                (report.location && report.location !== 'Reported at this node' ? report.location : '') ||
                report.node_id ||
                'Community Hub';
              const isLost = report.type === 'lost';
              const isPrompting = promptingId === report.id;

              return (
                <div
                  key={report.id}
                  className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-white/5 flex justify-between items-start">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-sm ${
                            isLost ? 'bg-[#E24A3B]/20 text-[#E24A3B]' : 'bg-[#F2C94C]/20 text-[#F2C94C]'
                          }`}
                        >
                          {isLost ? 'LOST ITEM' : 'FOUND ITEM'}
                        </span>
                        <span className="text-[#8A928B] text-xs">{formatTime(report.reportedAt)}</span>
                      </div>
                      <h3 className="text-lg font-medium leading-snug break-words">{report.description}</h3>
                      <p className="text-[#8A928B] text-xs font-mono uppercase tracking-wider mt-1 break-words">
                        📍 {locationName}
                      </p>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-3 bg-black/20 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <a
                        href={getContactLink(report.contact)}
                        className="flex-1 bg-white/10 hover:bg-white/15 transition-colors py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold"
                      >
                        {report.contact.includes('@') ? <Mail size={16} /> : <Phone size={16} />}
                        Contact Reporter
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          if (isPrompting) {
                            setPromptingId(null);
                            setCodeInput('');
                            setResolveError(null);
                          } else {
                            setPromptingId(report.id);
                            setCodeInput('');
                            setResolveError(null);
                          }
                        }}
                        disabled={resolvingId === report.id}
                        className="px-5 bg-[#2A2A2A] hover:bg-[#333] transition-colors rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#8A928B] hover:text-white"
                        title="Mark as Resolved"
                      >
                        {resolvingId === report.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 size={18} />
                            <span>Resolve</span>
                          </>
                        )}
                      </button>
                    </div>

                    {isPrompting && (
                      <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#A3A3AA]">
                            Enter 6-character resolve code to close this report:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setPromptingId(null);
                              setCodeInput('');
                              setResolveError(null);
                            }}
                            className="text-[#8A928B] hover:text-white"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={8}
                            value={codeInput}
                            onChange={(e) => {
                              setCodeInput(e.target.value.toUpperCase());
                              if (resolveError) setResolveError(null);
                            }}
                            placeholder="CODE"
                            className="flex-1 bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono uppercase tracking-widest text-white focus:outline-none focus:border-[#F2C94C]"
                          />
                          <button
                            type="button"
                            disabled={resolvingId === report.id}
                            onClick={() => handleConfirmResolve(report)}
                            className="px-4 py-2 rounded-lg bg-[#F2C94C] text-black text-xs font-bold uppercase tracking-wider hover:bg-[#f5d469] transition-colors disabled:opacity-50"
                          >
                            Confirm
                          </button>
                        </div>
                        {resolveError && <p className="text-xs text-[#FF8577]">{resolveError}</p>}
                      </div>
                    )}
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
