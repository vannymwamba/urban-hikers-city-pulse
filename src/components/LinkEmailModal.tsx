import React, { useState } from 'react';
import { Mail, Key, X, ShieldCheck, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { sendKeepLink, linkEmailWithPassword, upgradeWithGoogle } from '../utils/identityUpgrade';
import { saveVisitorConsent } from '../utils/visitorProfile';
import { auth } from '../firebase';
import type { UserProfile } from '../types';

interface LinkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail?: string | null;
  onLinked?: (email: string, profile: UserProfile) => void;
}

export function LinkEmailModal({
  isOpen,
  onClose,
  currentEmail,
  onLinked
}: LinkEmailModalProps) {
  const [email, setEmail] = useState(currentEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<'link' | 'password'>('link');
  const [recapOptIn, setRecapOptIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validateEmail = (val: string) => {
    return val.trim().length > 3 && val.includes('@') && val.includes('.');
  };

  // 1. Passwordless Email Link Authentication
  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!validateEmail(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await sendKeepLink(cleanEmail);
      if (auth.currentUser?.uid) {
        await saveVisitorConsent(auth.currentUser.uid, cleanEmail, recapOptIn);
      }
      setLinkSent(true);
      setSuccessMessage(`Sign-in link sent to ${cleanEmail}. Click the link on this device to finalize.`);
    } catch (err: any) {
      console.error('Error sending link:', err);
      if (err?.code === 'auth/invalid-email') {
        setError('The email address format is invalid.');
      } else {
        setError('Could not send the verification link. Please check your internet or try password linking.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Instant Password-based Firebase Email Authentication
  const handleLinkWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!validateEmail(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const profile = await linkEmailWithPassword(cleanEmail, password);
      if (auth.currentUser?.uid) {
        await saveVisitorConsent(auth.currentUser.uid, cleanEmail, recapOptIn);
      }
      setSuccessMessage(`Email ${cleanEmail} successfully linked to your explorer profile!`);
      onLinked?.(cleanEmail, profile);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error linking with password:', err);
      if (err?.code === 'auth/email-already-in-use' || err?.code === 'auth/credential-already-in-use') {
        setError('This email is already associated with another account. Please enter your existing password to merge your explorer progress.');
      } else if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setError('Incorrect password for this email account.');
      } else if (err?.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err?.message || 'Could not link email. Please try magic link or Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Google OAuth option
  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await upgradeWithGoogle();
      const linked = profile.email || auth.currentUser?.email || email;
      if (auth.currentUser?.uid && linked) {
        await saveVisitorConsent(auth.currentUser.uid, linked, recapOptIn);
      }
      setSuccessMessage(`Google account linked successfully!`);
      onLinked?.(linked, profile);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError('Could not connect with Google. Please use the email options.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div 
        className="w-full sm:max-w-md rounded-3xl border border-[#26262A] bg-[#161618] p-6 text-white shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FFE01A] via-[#4ADE80] to-[#FFE01A]" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#A3A3AA] hover:text-white transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-[#FFE01A]/10 border border-[#FFE01A]/30 flex items-center justify-center text-[#FFE01A] shrink-0">
            <Mail size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFE01A] block">
              USER PROTOCOL · IDENTITY
            </span>
            <h2 className="text-lg font-bold text-white leading-snug">
              {currentEmail ? 'Update Linked Email' : 'Link Your Email'}
            </h2>
          </div>
        </div>

        <p className="text-xs text-[#A3A3AA] leading-relaxed mb-4">
          Connect an email to your anonymous explorer profile. Your taps, trail badges, and BLINK recap will stay synced across your devices.
        </p>

        {successMessage ? (
          <div className="bg-[#4ADE80]/10 border border-[#4ADE80]/30 rounded-2xl p-5 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#4ADE80]/20 text-[#4ADE80] flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-xs font-bold text-[#4ADE80] leading-relaxed">
              {successMessage}
            </p>
            {linkSent && (
              <p className="text-[11px] text-[#A3A3AA]">
                Open the link in your email on this phone to lock it in. You can safely close this modal.
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-2 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Auth Mode Tabs: Magic Link vs Password */}
            <div className="flex bg-[#0B0B0D] p-1 rounded-xl border border-[#26262A] mb-4">
              <button
                type="button"
                onClick={() => { setAuthMode('link'); setError(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'link'
                    ? 'bg-[#FFE01A] text-black shadow'
                    : 'text-[#A3A3AA] hover:text-white'
                }`}
              >
                Passwordless Link
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('password'); setError(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'password'
                    ? 'bg-[#FFE01A] text-black shadow'
                    : 'text-[#A3A3AA] hover:text-white'
                }`}
              >
                Set Password
              </button>
            </div>

            <form onSubmit={authMode === 'link' ? handleSendMagicLink : handleLinkWithPassword} className="space-y-3.5">
              {/* Email Input */}
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A3A3AA] block mb-1.5">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-[#A3A3AA] pointer-events-none">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    autoFocus
                    required
                    className="w-full bg-[#0B0B0D] border border-[#26262A] focus:border-[#FFE01A] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-[#555] outline-none transition-colors font-medium"
                  />
                </div>
              </div>

              {/* Password Input (if Password mode) */}
              {authMode === 'password' && (
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A3A3AA] block mb-1.5">
                    Account Password
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-[#A3A3AA] pointer-events-none">
                      <Key size={16} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      minLength={6}
                      className="w-full bg-[#0B0B0D] border border-[#26262A] focus:border-[#FFE01A] rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-[#555] outline-none transition-colors font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-[#A3A3AA] hover:text-white transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* BLINK Wrapped Recap Checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1 select-none">
                <input
                  type="checkbox"
                  checked={recapOptIn}
                  onChange={(e) => setRecapOptIn(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-black/40 text-[#FFE01A] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#FFE01A]"
                />
                <span className="text-[11px] text-[#A3A3AA] leading-snug">
                  Send me my personalized <strong className="text-white">BLINK Wrapped</strong> walk recap and trail updates
                </span>
              </label>

              {/* Error Banner */}
              {error && (
                <div className="p-3 rounded-xl bg-[#E24A3B]/10 border border-[#E24A3B]/30 text-xs text-[#E24A3B] leading-snug">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[46px] rounded-xl bg-[#FFE01A] hover:bg-[#ebd017] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Processing...</span>
                ) : authMode === 'link' ? (
                  <>
                    <span>Send Verification Link</span>
                    <ArrowRight size={15} />
                  </>
                ) : (
                  <>
                    <span>Link Email Instantly</span>
                    <CheckCircle2 size={15} />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#26262A]" />
              </div>
              <div className="relative flex justify-center text-[10px] font-mono uppercase text-[#A3A3AA]">
                <span className="bg-[#161618] px-2">or link with provider</span>
              </div>
            </div>

            {/* Google Link Option */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogle}
              className="w-full min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-3 text-center text-xs text-[#A3A3AA] hover:text-white transition-colors cursor-pointer"
            >
              Maybe later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
