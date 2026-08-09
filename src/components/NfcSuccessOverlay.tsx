import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Award, Sparkles, Navigation, CheckCircle2, UserPlus, Heart, X, Volume2 } from 'lucide-react';

interface NfcSuccessOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  nodeName: string;
  xpAwarded?: number;
  badgeEarned?: string | null;
  onSocialRecord?: (metSomeone: boolean) => void;
}

export const NfcSuccessOverlay: React.FC<NfcSuccessOverlayProps> = ({
  isOpen,
  onClose,
  nodeName = 'Findlay Market',
  xpAwarded = 20,
  badgeEarned = null,
  onSocialRecord
}) => {
  const [metSomeone, setMetSomeone] = useState<boolean | null>(null);
  const [showBonus, setShowBonus] = useState(false);

  const handleSocialClick = (answer: boolean) => {
    setMetSomeone(answer);
    if (answer) {
      setShowBonus(true);
      onSocialRecord?.(true);
    } else {
      onSocialRecord?.(false);
    }
  };

  // Play a mock synthesizer frequency on success (optional/decorative)
  const playTactileBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitched clean chirp (A5)
      oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.15); // Slide up

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("AudioContext not supported or gesture missing");
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      playTactileBeep();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl pointer-events-auto"
        >
          {/* Electromagnetic pulsing grid base */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#FFE01A]/10 via-transparent to-transparent opacity-50" />
            
            {/* Concentric magnetic pulse rings */}
            {[1, 2, 3].map((ring) => (
              <motion.div
                key={ring}
                initial={{ scale: 0.1, opacity: 0.8 }}
                animate={{ scale: 3.5, opacity: 0 }}
                transition={{
                  repeat: Infinity,
                  duration: 2.2,
                  delay: (ring - 1) * 0.7,
                  ease: "easeOut"
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#FFE01A]/40 w-[200px] h-[200px]"
              />
            ))}
            
            {/* Glowing vertical trace line */}
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: "100%" }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="absolute left-1/2 w-[1px] h-32 bg-gradient-to-b from-transparent via-[#FFE01A] to-transparent opacity-20"
            />
          </div>

          <motion.div
            initial={{ scale: 0.9, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 30, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 180 }}
            className="w-full max-w-sm bg-[#0e0e0e] border border-[#FFE01A]/20 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-[0_0_80px_rgba(255,224,26,0.15)] text-center flex flex-col gap-6"
          >
            {/* Top Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Sparkle particles */}
            <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ ease: "linear", duration: 10, repeat: Infinity }}
                className="relative"
              >
                <Sparkles size={16} className="text-[#FFE01A] absolute -top-8 -left-10 animate-pulse" />
                <Sparkles size={12} className="text-[#39ff14] absolute -bottom-6 -right-12" />
                <Sparkles size={14} className="text-[#ff2d78] absolute top-8 -right-8 animate-pulse" />
              </motion.div>
            </div>

            {/* Success Visual: Core Pulse Disk */}
            <div className="relative flex justify-center mt-4">
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-24 h-24 rounded-full bg-[#FFE01A]/10 border-2 border-[#FFE01A] flex items-center justify-center relative shadow-[0_0_30px_rgba(255,224,26,0.25)]"
              >
                <motion.div 
                  className="absolute inset-0 rounded-full bg-[#FFE01A]/5"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                />
                
                {/* Visual tactile audio waveform inside circle */}
                <div className="absolute inset-x-0 bottom-4 flex justify-center gap-0.5 pointer-events-none opacity-40">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [4, 16, 4] }}
                      transition={{ repeat: Infinity, duration: 0.4 + i * 0.1, ease: "easeInOut" }}
                      className="w-[2px] bg-[#FFE01A] rounded-full"
                    />
                  ))}
                </div>

                <ShieldCheck size={40} className="text-[#FFE01A]" />
              </motion.div>
              
              {/* Floating XP badge */}
              <motion.div
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="absolute -bottom-2 right-12 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg"
              >
                +{xpAwarded} XP
              </motion.div>
            </div>

            {/* Tap Identity Callout */}
            <div className="space-y-1 mt-2">
              <span className="text-[8px] font-mono font-black uppercase tracking-[0.25em] text-[#FFE01A]">
                NFC_TAG_IGNITED_SUCCESSFUL
              </span>
              <h2 className="text-white text-xl font-black uppercase tracking-tight italic">
                {nodeName}
              </h2>
              <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider">
                REFUEL STATION VERIFIED // CINCINNATI OS
              </p>
            </div>

            {/* Special localized dynamic benefit unlock */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/3 border border-white/5 rounded-2xl p-4 text-left font-mono space-y-1.5 relative overflow-hidden"
            >
              <div className="absolute right-3 top-3 opacity-10">
                <Navigation size={28} className="text-[#FFE01A]" />
              </div>
              
              <span className="text-[7.5px] font-black text-[#888] uppercase block tracking-widest">
                LOCAL_SURE_BENEFITS
              </span>
              <div className="text-[11.5px] font-black text-white uppercase flex items-center gap-2">
                <span className="text-[#FFE01A]">⚡</span> 10% Discount Unlocked
              </div>
              <p className="text-white/40 text-[9px] leading-tight">
                Refuel protocol activated! Flash voucher stored in your Explorer Passport. Show at check-out.
              </p>
            </motion.div>

            {/* Dynamic Badge unlock presentation */}
            {badgeEarned && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-purple-950/20 border border-purple-500/20 p-4 rounded-2xl flex items-center gap-3 text-left relative overflow-hidden"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Award size={20} />
                </div>
                <div>
                  <span className="text-[8px] font-mono text-purple-400 font-black uppercase tracking-wider block">BADGE UNLOCKED!</span>
                  <span className="text-white text-xs font-black uppercase tracking-tight">{badgeEarned}</span>
                </div>
              </motion.div>
            )}

            {/* Interpersonal connection checkpoint (Reduction of Isolation mechanism!) */}
            <div className="border-t border-white/5 pt-5 mt-1 space-y-3.5">
              <div className="text-center">
                <h4 className="text-white/70 text-[11px] font-black uppercase tracking-widest leading-tight">
                  Did you meet someone here?
                </h4>
                <p className="text-white/30 text-[8px] font-mono uppercase mt-1">
                  Proven community engagement awards bonus XP
                </p>
              </div>

              {metSomeone === null ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleSocialClick(true)}
                    className="py-2.5 rounded-xl border border-white/10 hover:border-[#FFE01A] bg-white/3 hover:bg-[#FFE01A]/5 text-white/80 hover:text-[#FFE01A] font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserPlus size={12} />
                    Yes
                  </button>
                  <button
                    onClick={() => handleSocialClick(false)}
                    className="py-2.5 rounded-xl border border-white/10 hover:border-white/30 bg-white/3 hover:bg-white/5 text-white/50 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                  >
                    No
                  </button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-900/10 border border-emerald-500/20 py-3 px-4 rounded-xl text-center"
                >
                  {showBonus ? (
                    <span className="text-emerald-400 font-black text-[10px] uppercase tracking-wider font-mono flex items-center justify-center gap-1.5">
                      <Heart size={12} className="fill-emerald-400" />
                      Social Connection Saved! +10 XP Bonus
                    </span>
                  ) : (
                    <span className="text-white/40 font-bold text-[10px] uppercase tracking-wider font-mono">
                      Feedback logged
                    </span>
                  )}
                </motion.div>
              )}
            </div>

            {/* Done Action Button */}
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-[#FFE01A] hover:bg-[#FFE01A]/90 text-black rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] shadow-xl shadow-[#FFE01A]/10 mt-2 cursor-pointer"
            >
              Dismiss Protocol
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
