import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Clock, ExternalLink, Share2, Wallet, Calendar } from 'lucide-react';
import { Broadcast, Node, Partner } from '../types';
import { VibeCheck } from './VibeCheck';
import { VibeTrend } from './VibeTrend';

interface BroadcastModalProps {
  broadcast: Broadcast | null;
  onClose: () => void;
  onShare: (title: string, text: string, url: string) => void;
  onSaveToWallet?: (node: Node) => void;
  isSaved?: boolean;
  node: Node | null;
  onVibeReport?: (vibe: any) => void;
  isReporting?: boolean;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  broadcast,
  onClose,
  onShare,
  onSaveToWallet,
  isSaved,
  node,
  onVibeReport,
  isReporting
}) => {
  const startsAt = broadcast?.startsAt || broadcast?.starts_at;
  const expiresAt = broadcast?.expiresAt || broadcast?.expires_at;

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <AnimatePresence>
      {broadcast && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header Image */}
            <div className="relative h-64 sm:h-80 shrink-0">
              <img 
                src={broadcast.cover_url || broadcast.imageUrl || `https://picsum.photos/seed/${broadcast.type}/800/500`} 
                alt={broadcast.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="absolute bottom-8 left-8 right-8">
                <div className="text-[10px] font-black tracking-[0.2em] text-uh-yellow uppercase mb-2 font-mono">
                  {broadcast.type.replace('_', ' ')}
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight leading-tight">
                  {broadcast.title}
                </h2>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Info */}
                <div className="md:col-span-2 space-y-8">
                  <section>
                    <div className="text-[10px] font-black tracking-widest text-uh-gray-400 uppercase mb-4 font-mono">Signal_Intel</div>
                    <div className="bg-uh-gray-50 rounded-[32px] p-6 border border-uh-gray-100">
                      <p className="text-[15px] text-uh-gray-800 leading-relaxed font-sans font-medium whitespace-pre-wrap">
                        {broadcast.description || "NO_ADDITIONAL_INTEL_AVAILABLE_FOR_THIS_SIGNAL."}
                      </p>
                    </div>
                  </section>

                  <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-black tracking-widest text-uh-gray-400 uppercase mb-3 font-mono">Location</div>
                      <div className="flex items-start gap-3 p-4 bg-uh-gray-50 rounded-[24px] border border-uh-gray-100">
                        <MapPin size={18} className="text-uh-yellow shrink-0 mt-0.5" />
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-uh-black uppercase tracking-tight">
                            {broadcast.venue || broadcast.meeting_point || 'Washington Park'}
                          </span>
                          {broadcast.address && (
                            <span className="text-[10px] text-uh-gray-400 font-medium">{broadcast.address}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-black tracking-widest text-uh-gray-400 uppercase mb-3 font-mono">Schedule</div>
                      <div className="flex items-start gap-3 p-4 bg-uh-gray-50 rounded-[24px] border border-uh-gray-100">
                        <Calendar size={18} className="text-uh-yellow shrink-0 mt-0.5" />
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-uh-black uppercase tracking-tight">
                            {formatDate(startsAt)}
                          </span>
                          <span className="text-[10px] text-uh-gray-400 font-medium">
                            {formatTime(startsAt)} — {formatTime(expiresAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="grid grid-cols-1 gap-8">
                    <div>
                      <div className="text-[10px] font-black tracking-widest text-uh-gray-400 uppercase mb-4 font-mono">Vibe_Check</div>
                      <VibeCheck onReport={(vibe) => onVibeReport?.(vibe)} isReporting={isReporting} />
                    </div>
                    
                    <div>
                      <div className="text-[10px] font-black tracking-widest text-uh-gray-400 uppercase mb-4 font-mono">Vibe_Trend_Analysis</div>
                      <VibeTrend broadcastId={broadcast.id} />
                    </div>
                  </div>
                </div>

                {/* Sidebar Actions */}
                <div className="space-y-6">
                  <div className="text-[10px] font-black tracking-widest text-uh-gray-400 uppercase mb-4 font-mono">Protocol_Actions</div>
                  
                  <div className="flex flex-col gap-3">
                    {broadcast.sourceUrl && (
                      <button 
                        onClick={() => window.open(broadcast.sourceUrl!, '_blank')}
                        className="w-full bg-uh-yellow text-uh-black py-4 rounded-[24px] flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg shadow-uh-yellow/20 font-black uppercase tracking-widest text-[11px] font-mono"
                      >
                        <ExternalLink size={16} />
                        View Source
                      </button>
                    )}

                    <button 
                      onClick={() => onShare(
                        broadcast.title,
                        `Check out this event!`,
                        window.location.href
                      )}
                      className="w-full bg-uh-gray-50 text-uh-black py-4 rounded-[24px] flex items-center justify-center gap-2 hover:bg-uh-gray-100 transition-colors border border-uh-gray-100 font-black uppercase tracking-widest text-[11px] font-mono"
                    >
                      <Share2 size={16} />
                      Share Signal
                    </button>

                    {node && onSaveToWallet && (
                      <button 
                        onClick={() => onSaveToWallet(node)}
                        className={`w-full py-4 rounded-[24px] flex items-center justify-center gap-2 transition-all border font-black uppercase tracking-widest text-[11px] font-mono ${
                          isSaved 
                            ? 'bg-uh-magenta text-white border-uh-magenta shadow-lg shadow-uh-magenta/20' 
                            : 'bg-uh-gray-50 text-uh-black border-uh-gray-100 hover:bg-uh-gray-100'
                        }`}
                      >
                        <Wallet size={16} />
                        {isSaved ? "Saved to Wallet" : "Save Hub"}
                      </button>
                    )}
                  </div>

                  {broadcast.price !== undefined && (
                    <div className="p-6 bg-uh-black rounded-[32px] text-center">
                      <div className="text-[10px] font-black text-uh-yellow/50 uppercase tracking-[0.2em] mb-2 font-mono">Access_Cost</div>
                      <div className="text-3xl font-black text-white font-mono">
                        {broadcast.price === 0 ? 'FREE' : `$${broadcast.price}`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
