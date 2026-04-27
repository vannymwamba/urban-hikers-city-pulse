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
  confirmed?: boolean;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  broadcast,
  onClose,
  onShare,
  onSaveToWallet,
  isSaved,
  node,
  onVibeReport,
  isReporting,
  confirmed = false
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
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header Image */}
            <div className="relative h-64 sm:h-80 shrink-0">
              <img 
                src={broadcast.cover_url || broadcast.imageUrl || `https://picsum.photos/seed/${broadcast.type}/800/500`} 
                alt={broadcast.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center bg-black/40 text-white rounded-full backdrop-blur-md hover:bg-black/60 transition-all z-10"
              >
                <X size={24} />
              </button>

              <div className="absolute bottom-8 left-8 right-8">
                 <div className="text-uh-yellow text-[11px] font-black tracking-[0.2em] uppercase font-mono mb-2">Local_Signal</div>
                <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight leading-tight">
                  {broadcast.title}
                </h2>
              </div>
            </div>

            {/* Confirmed banner */}
            {confirmed && (
              <div className="bg-uh-teal px-8 py-3 flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center bg-white/20 text-white rounded-full text-[10px] font-black shrink-0">✓</div>
                <span className="text-[11px] font-black text-white uppercase tracking-widest font-mono">Signal_Confirmed // Ready for Tap</span>
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-uh-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Info */}
                <div className="md:col-span-2 space-y-8">
                  <section>
                    <h3 className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest font-mono mb-3">Signal_Intel</h3>
                    <p className="text-uh-gray-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                      {broadcast.description || "No additional intel available for this signal."}
                    </p>
                  </section>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 bg-white rounded-2xl border border-uh-gray-100 shadow-sm transition-all hover:shadow-md">
                      <div className="text-[9px] font-black text-uh-gray-400 uppercase tracking-widest font-mono mb-3">Location</div>
                      <div className="flex items-start gap-2">
                        <MapPin size={16} className="text-uh-yellow shrink-0 mt-0.5" />
                        <span className="text-xs font-black text-uh-black uppercase tracking-tight">
                          {broadcast.venue || broadcast.meeting_point || 'Washington Park'}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 bg-white rounded-2xl border border-uh-gray-100 shadow-sm transition-all hover:shadow-md">
                      <div className="text-[9px] font-black text-uh-gray-400 uppercase tracking-widest font-mono mb-3">Window</div>
                      <div className="flex items-start gap-2">
                        <Clock size={16} className="text-uh-yellow shrink-0 mt-0.5" />
                        <span className="text-xs font-black text-uh-black uppercase tracking-tight">
                          {formatTime(startsAt)} — {formatTime(expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8 pt-4">
                    <div>
                      <h3 className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest font-mono mb-4">Vibe_Telemetry</h3>
                      <VibeCheck onReport={(vibe) => onVibeReport?.(vibe)} isReporting={isReporting} />
                    </div>
                    
                    <div>
                      <h3 className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest font-mono mb-4">Pulse_History</h3>
                      <VibeTrend broadcastId={broadcast.id} />
                    </div>
                  </div>
                </div>

                {/* Sidebar Actions */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest font-mono mb-4">Actions</h3>
                    <div className="flex flex-col gap-3">
                      {(broadcast.booking_url || broadcast.sourceUrl) && (
                        <button 
                          onClick={() => window.open((broadcast.booking_url || broadcast.sourceUrl)!, '_blank')}
                          className="w-full bg-uh-yellow text-uh-black py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-lg shadow-uh-yellow/10"
                        >
                          {broadcast.type === 'donation' ? 'Donate ♥' : 
                           broadcast.type === 'walking_event' ? 'Book Now ↗' : 
                           broadcast.type === 'flash_deal' ? 'Claim Deal ↗' : 
                           'Execute_Source'}
                        </button>
                      )}

                      <button 
                        onClick={() => onShare(broadcast.title, `Check out this signal: ${broadcast.title}`, window.location.href)}
                        className="w-full bg-white text-uh-black py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-uh-gray-100 hover:bg-uh-gray-50 transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                        <Share2 size={14} />
                        Share_Signal
                      </button>

                      {node && onSaveToWallet && (
                        <button 
                          onClick={() => onSaveToWallet(node)}
                          className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
                            isSaved 
                              ? 'bg-uh-magenta text-white border-uh-magenta shadow-lg shadow-uh-magenta/10' 
                              : 'bg-white text-uh-gray-400 border-uh-gray-100 hover:text-uh-black shadow-sm'
                          }`}
                        >
                          {isSaved ? <Clock size={14} /> : <Wallet size={14} />}
                          {isSaved ? "Saved_to_Wallet" : "Save_Hub"}
                        </button>
                      )}
                    </div>
                  </div>

                  {broadcast.price !== undefined && (
                    <div className="p-6 bg-uh-black rounded-2xl text-center flex flex-col gap-1 shadow-xl">
                      <span className="text-[9px] font-black text-uh-gray-400 uppercase tracking-[0.2em]">Access_Level</span>
                      <span className="text-2xl font-black text-uh-yellow italic">
                        {broadcast.price === 0 ? 'FREE' : `$${broadcast.price}`}
                      </span>
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
