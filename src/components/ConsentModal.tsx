import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, MapPin, Zap, Lock, CheckCircle2, X } from 'lucide-react';

interface ConsentModalProps {
  isOpen: boolean;
  onConsent?: () => void;
  onClose?: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onConsent,
  onClose
}) => {
  if (!isOpen) return null;

  const handleClose = () => {
    if (onConsent) onConsent();
    if (onClose) onClose();
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-[#121212] border-t border-x border-white/10 rounded-t-3xl p-6 shadow-2xl relative text-white font-sans overflow-hidden max-h-[85vh] overflow-y-auto"
        >
          {/* Top Decorative Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-uh-yellow to-hud-magenta" />

          {/* Visual Drag / Handle Bar */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 shrink-0" />

          {/* Close Icon Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 text-white/50 hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide uppercase text-white">
                Trail Tap Consent
              </h2>
              <p className="text-xs text-white/50 font-mono">
                Consent Protocol v1.0
              </p>
            </div>
          </div>

          {/* Explanation Content */}
          <div className="space-y-3 mb-6 text-xs text-white/80 leading-relaxed">
            <p>
              To record your presence at Urban Hikers installation nodes and unlock trail passports, we log anonymous tap data and session continuity.
            </p>

            <div className="bg-white/5 border border-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-uh-yellow shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Node Location:</span> Verified against static artwork installation coordinates.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Session Continuity:</span> Groups your taps across the trail using a secure device ID.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-hud-magenta shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Privacy First:</span> No location tracking outside of explicit physical NFC node interactions.
                </div>
              </div>
            </div>

            <p className="text-[11px] text-white/50 italic">
              By continuing, you agree to record your tap interaction under Consent Version <span className="font-mono text-teal-400">v1.0</span>.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <button
              id="consent-modal-agree-btn"
              onClick={handleClose}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-black font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Got It
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
