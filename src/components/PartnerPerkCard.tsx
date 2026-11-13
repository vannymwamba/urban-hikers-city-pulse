import React, { useState, useEffect } from 'react';
import { Coffee, CheckCircle2, Sparkles, MapPin, Store, ShieldCheck, ChevronRight } from 'lucide-react';
import { generatePerkCode, redeemPartnerPerk } from '../utils/visitorProfile';

interface PartnerPerkCardProps {
  tapCount: number;
  userUid?: string;
  partnerName?: string;
  partnerAddress?: string;
  perkTitle?: string;
  perkDeal?: string;
}

export function PartnerPerkCard({
  tapCount,
  userUid,
  partnerName = 'Urbana Cafe',
  partnerAddress = '1206 Vine St · Over-The-Rhine (3 min walk)',
  perkTitle = 'Refuel Partner Perk',
  perkDeal = 'Free Drip Coffee or $3 Off Any Craft Drink'
}: PartnerPerkCardProps) {
  const isUnlocked = tapCount >= 3;
  const perkCode = generatePerkCode(userUid);

  const [isRedeemed, setIsRedeemed] = useState(false);
  const [redeemedAtStr, setRedeemedAtStr] = useState<string | null>(null);
  const [isConfirmingStaff, setIsConfirmingStaff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check initial local redemption status
  useEffect(() => {
    if (userUid) {
      try {
        const localData = localStorage.getItem(`uh_perk_redeemed_${userUid}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          if (parsed?.redeemedAt) {
            setIsRedeemed(true);
            const d = new Date(parsed.redeemedAt);
            setRedeemedAtStr(d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
          }
        }
      } catch {
        // Ignore JSON error
      }
    }
  }, [userUid]);

  const handleStaffConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await redeemPartnerPerk(userUid || 'anon', perkCode, partnerName);
      if (res.success) {
        setIsRedeemed(true);
        const d = new Date(res.redeemedAt);
        setRedeemedAtStr(d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        setIsConfirmingStaff(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-[#141417] rounded-2xl border border-white/10 overflow-hidden mb-5">
      {/* Header bar */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#F2C94C]/15 border border-[#F2C94C]/30 flex items-center justify-center">
            <Coffee size={14} className="text-[#F2C94C]" />
          </div>
          <div>
            <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-[#F2C94C] uppercase block">
              PARTNER PERK
            </span>
            <span className="font-mono text-[9px] text-[#8A928B] uppercase tracking-wider block">
              VERIFIED FOOT TRAFFIC
            </span>
          </div>
        </div>

        {isUnlocked ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-[#F2C94C]/20 text-[#F2C94C] border border-[#F2C94C]/40 animate-pulse">
            <Sparkles size={11} />
            UNLOCKED
          </span>
        ) : (
          <span className="font-mono text-[10px] font-bold tracking-wider text-[#8A928B] uppercase tabular-nums">
            {Math.min(tapCount, 3)} / 3 TAPS
          </span>
        )}
      </div>

      <div className="p-5">
        {!isUnlocked ? (
          /* Locked Progress State */
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Unlock {perkTitle}
              </h3>
              <p className="text-xs text-[#8A928B] mt-1 leading-relaxed">
                Tap 3 artworks on your walk to unlock <span className="text-white font-bold">{perkDeal}</span> at {partnerName}.
              </p>
            </div>

            {/* 3-tap segmented progress bar */}
            <div className="grid grid-cols-3 gap-2 py-1">
              {[1, 2, 3].map((step) => {
                const filled = tapCount >= step;
                return (
                  <div key={step} className="flex flex-col gap-1">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        filled ? 'bg-[#F2C94C]' : 'bg-white/10'
                      }`}
                    />
                    <span className="font-mono text-[9px] text-center text-[#8A928B] uppercase">
                      Stop {step} {filled ? '✓' : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-[#8A928B]">
              <Store size={13} className="text-[#F2C94C] shrink-0" />
              <span className="truncate">{partnerName} · {partnerAddress}</span>
            </div>
          </div>
        ) : (
          /* Unlocked State */
          <div className="flex flex-col gap-4">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] text-[#F2C94C] uppercase tracking-wider font-bold">
                REWARD UNLOCKED • READY TO REDEEM
              </span>
              <h3 className="text-lg font-black text-white uppercase tracking-tight mt-0.5">
                {perkDeal}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-[#8A928B] mt-1">
                <MapPin size={13} className="text-[#F2C94C] shrink-0" />
                <span>{partnerName} · {partnerAddress}</span>
              </div>
            </div>

            {/* Counter Code Box */}
            <div className="bg-black/60 border border-white/15 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#F2C94C]/20 via-[#F2C94C] to-[#F2C94C]/20" />
              
              <span className="font-mono text-[10px] tracking-widest text-[#8A928B] uppercase mb-1">
                SHOW CODE AT COUNTER
              </span>

              <div className="font-mono text-3xl font-black tracking-[0.2em] text-[#F2C94C] py-1 select-all">
                {perkCode}
              </div>

              <span className="text-[11px] text-white/70 mt-1">
                Staff confirms this short code to log your visit
              </span>
            </div>

            {/* Staff Verification Section */}
            {!isRedeemed ? (
              <div className="flex flex-col gap-2">
                {!isConfirmingStaff ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingStaff(true)}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/10 active:bg-white/15 border border-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-[#F2C94C]" />
                      <span>Staff: Tap to Confirm at Counter</span>
                    </span>
                    <ChevronRight size={14} className="text-[#8A928B]" />
                  </button>
                ) : (
                  <div className="bg-[#1C1C21] border border-[#F2C94C]/40 rounded-xl p-3.5 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-[#F2C94C] uppercase tracking-wider">
                        COUNTER VERIFICATION
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsConfirmingStaff(false)}
                        className="text-[11px] text-[#8A928B] hover:text-white px-2 py-0.5"
                      >
                        Cancel
                      </button>
                    </div>

                    <p className="text-xs text-white/90 leading-tight">
                      Confirming {partnerName} redemption for code <strong className="text-[#F2C94C] font-mono">{perkCode}</strong>.
                    </p>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleStaffConfirm}
                      className="w-full min-h-[44px] bg-[#F2C94C] hover:bg-[#d9b33e] text-[#0B0B0D] font-black text-xs uppercase tracking-wider rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors"
                    >
                      <CheckCircle2 size={16} />
                      <span>{isSubmitting ? 'Verifying...' : 'Confirm Redemption Now'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#1C281D] border border-[#2E6B34] rounded-xl p-3 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-[#4CD964] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-[11px] font-bold text-[#4CD964] uppercase tracking-wider">
                    VERIFIED AT COUNTER ✓
                  </span>
                  <span className="text-[11px] text-white/70 truncate">
                    Redeemed at {partnerName} {redeemedAtStr ? `at ${redeemedAtStr}` : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
