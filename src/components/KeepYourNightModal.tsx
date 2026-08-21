import React, { useState } from 'react';
import { upgradeWithGoogle, sendKeepLink } from '../utils/identityUpgrade';
import type { UserProfile } from '../types';

export function KeepYourNightModal({ isOpen, onClose, onUpgraded }: {
  isOpen: boolean; onClose: () => void; onUpgraded?: (p: UserProfile) => void;
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isOpen) return null;

  const google = async () => {
    setLoading(true); setError(null);
    try { const p = await upgradeWithGoogle(); onUpgraded?.(p); onClose(); }
    catch (e: any) { if (e?.code !== 'auth/popup-closed-by-user') setError('Could not connect Google — try the email option.'); }
    finally { setLoading(false); }
  };
  const emailLink = async () => {
    if (!email.includes('@')) { setError('Enter a valid email.'); return; }
    setLoading(true); setError(null);
    try { await sendKeepLink(email); setSent(true); }
    catch { setError('Could not send the link — try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-sm m-3 rounded-2xl border border-white/10 bg-[#12181e] p-6" onClick={e => e.stopPropagation()}>
        <div className="text-[11px] tracking-[0.2em] uppercase text-[#B8E62E] font-mono">Keep your night</div>
        <h2 className="mt-2 text-xl font-bold text-[#EDEFE9]">Saved on this phone.</h2>
        <p className="mt-2 text-sm text-[#8A928B]">Log in once to keep your walk forever — and see it on any device. Nothing you've already tapped is lost.</p>
        {sent ? (
          <p className="mt-5 text-sm text-[#4FC7D9]">Check your inbox — open the link on this phone to lock it in.</p>
        ) : (
          <>
            <button disabled={loading} onClick={google}
              className="mt-5 w-full rounded-full bg-[#EDEFE9] text-[#0C0F12] font-semibold py-3 disabled:opacity-60">
              Continue with Google
            </button>
            <div className="mt-3 flex gap-2">
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@email.com"
                className="flex-1 rounded-full bg-black/30 border border-white/10 px-4 py-2.5 text-sm text-[#EDEFE9] outline-none" />
              <button disabled={loading} onClick={emailLink}
                className="rounded-full border border-white/15 text-[#EDEFE9] px-4 text-sm disabled:opacity-60">Send</button>
            </div>
            <button onClick={onClose} className="mt-4 w-full text-center text-xs text-[#8A928B]">Maybe later</button>
          </>
        )}
        {error && <p className="mt-3 text-xs text-[#E8724D]">{error}</p>}
      </div>
    </div>
  );
}
