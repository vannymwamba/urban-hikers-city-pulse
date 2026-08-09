import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, MapPin, Zap, Lock, CheckCircle2 } from 'lucide-react';

interface ConsentModalProps {
  isOpen: boolean;
  onConsent: () => void;
  onClose?: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onConsent,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl p-6 shadow-2xl relative text-white font-sans overflow-hidden"
        >
          {/* Top Decorative Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-uh-yellow to-hud-magenta" />

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
              onClick={onConsent}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-black font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              I Agree & Continue Tapping
            </button>

            {onClose && (
              <button
                id="consent-modal-cancel-btn"
                onClick={onClose}
                className="w-full py-2 text-center text-xs text-white/40 hover:text-white/70 transition-colors uppercase font-mono tracking-wider"
              >
                Cancel
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
