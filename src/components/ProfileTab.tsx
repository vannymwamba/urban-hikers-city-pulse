import React, { useState, useEffect } from 'react';
import { Lock, LogOut, CheckCircle2 } from 'lucide-react';
import { 
  upgradeWithGoogle, 
  upgradeWithApple, 
  linkEmailWithPassword, 
  resetPassword 
} from '../utils/identityUpgrade';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { UserProfile, VisitorProfile } from '../types';

interface ProfileTabProps {
  user: any;
  userProfile: UserProfile | null;
  accentColor?: string;
  onLogin: () => void;
  onContinueAsGuest?: () => void;
  onProfileUpdate?: (profile: UserProfile) => void;
  nodesVisitedCount?: number;
  hubsTappedCount?: number;
  totalMiles?: number;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  userProfile,
  accentColor = '#FFE01A',
  onLogin,
  onContinueAsGuest,
  onProfileUpdate,
  nodesVisitedCount = 0,
  hubsTappedCount = 0,
  totalMiles = 0,
}) => {
  const linkedEmail = user?.email || userProfile?.email || null;
  const isGuest = !linkedEmail || user?.isAnonymous;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live visitor profile data (tracks taps, places, and combined mileage)
  const [visitorProfileData, setVisitorProfileData] = useState<VisitorProfile | null>(null);

  useEffect(() => {
    const currentUid = auth.currentUser?.uid || user?.uid;
    if (!currentUid) return;

    const unsub = onSnapshot(
      doc(db, 'visitor_profiles', currentUid),
      (snap) => {
        if (snap.exists()) {
          setVisitorProfileData(snap.data() as VisitorProfile);
        }
      },
      (err) => {
        console.warn('visitor_profiles real-time listener error:', err);
      }
    );

    return () => unsub();
  }, [auth.currentUser?.uid, user?.uid]);

  // Combined stats calculations
  const realTapsCount =
    visitorProfileData?.journey_stops?.length ||
    visitorProfileData?.locations_visited_ids?.length ||
    hubsTappedCount ||
    nodesVisitedCount ||
    0;

  const realPlacesCount =
    visitorProfileData?.locations_visited_ids?.length ||
    visitorProfileData?.journey_stops?.length ||
    (nodesVisitedCount > 0 ? Math.min(nodesVisitedCount, 8) : 0);

  const realMilesCount =
    visitorProfileData?.total_miles_explored != null
      ? Number(visitorProfileData.total_miles_explored).toFixed(1)
      : (totalMiles ? totalMiles.toFixed(1) : '0.0');

  // Google Instant Sign-In / Account Merge
  const handleGoogleSignIn = async () => {
    try {
      setLoadingProvider('google');
      setErrorMsg(null);
      setSuccessMsg(null);
      const profile = await upgradeWithGoogle();
      if (onProfileUpdate) {
        onProfileUpdate(profile);
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('Could not complete Google sign in. Please try again or use email.');
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  // Apple Instant Sign-In / Account Merge
  const handleAppleSignIn = async () => {
    try {
      setLoadingProvider('apple');
      setErrorMsg(null);
      setSuccessMsg(null);
      const profile = await upgradeWithApple();
      if (onProfileUpdate) {
        onProfileUpdate(profile);
      }
    } catch (err: any) {
      console.error('Apple sign in error:', err);
      if (
        err?.code === 'auth/configuration-not-found' ||
        err?.code === 'auth/operation-not-allowed'
      ) {
        setErrorMsg('Apple Sign-In is not enabled on this Firebase instance. Please use Google or Email.');
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('Could not complete Apple sign in. Please try again or use Google.');
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  // Email + Password Instant Sign-In & Tap Record Merge
  const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const profile = await linkEmailWithPassword(cleanEmail, password);
      if (onProfileUpdate) {
        onProfileUpdate(profile);
      }
      setSuccessMsg('Signed in! Your tapped record is now connected.');
    } catch (err: any) {
      console.error('Email sign-in error:', err);
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setErrorMsg('Incorrect password for this account. Tap "Forgot password?" to reset.');
      } else if (err?.code === 'auth/weak-password') {
        setErrorMsg('Password should be at least 6 characters.');
      } else {
        setErrorMsg(err?.message || 'Could not sign in. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Forgot Password handler
  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter your email above, then tap "Forgot password?".');
      return;
    }

    try {
      setErrorMsg(null);
      await resetPassword(cleanEmail);
      setSuccessMsg(`Password reset link sent to ${cleanEmail}. Check your inbox!`);
    } catch (err: any) {
      setErrorMsg('Could not send password reset email. Please verify your address.');
    }
  };

  return (
    <div className="w-full max-w-[520px] mx-auto px-[clamp(1rem,4vw,1.5rem)] pt-[clamp(1.25rem,3.5vw,2rem)] pb-28 flex flex-col gap-[clamp(1.5rem,4vw,2.25rem)] text-white">
      {/* 1. TOP ROW: Title ("PROFILE") + Pill Badge ("GUEST" or "VERIFIED") */}
      <div className="flex items-center justify-between pb-1">
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-none">
          PROFILE
        </h1>

        {isGuest ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181926] border border-[#2A2D40] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9BA1B0]" />
            <span className="text-xs font-mono font-bold text-[#9BA1B0] tracking-wider uppercase">
              GUEST
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181926] border border-[#2A2D40] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
            <span className="text-xs font-mono font-bold text-[#4ADE80] tracking-wider uppercase">
              CONNECTED
            </span>
          </div>
        )}
      </div>

      {/* 2. MAIN CARD: SIGN IN FORM (OR SIGNED-IN PROFILE VIEW) */}
      {isGuest ? (
        <div className="bg-[#161824] border border-[#252839] rounded-3xl p-6 sm:p-7 flex flex-col shadow-2xl">
          {/* Header */}
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-white leading-tight">
            SIGN IN
          </h2>
          <p className="text-sm text-[#9BA1B0] mt-1.5 leading-relaxed">
            One tap and you're back in — no email to go check.
          </p>

          {/* Social Sign-in Buttons */}
          <div className="mt-5 flex flex-col gap-3">
            {/* Continue with Apple */}
            <button
              type="button"
              onClick={handleAppleSignIn}
              disabled={loadingProvider === 'apple'}
              className="w-full min-h-[48px] py-3 px-4 rounded-xl font-mono text-sm font-bold flex items-center justify-center gap-2.5 bg-[#F4F3EE] hover:bg-white text-black transition-all cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 170 170">
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.08-7.71-7.98-12.04-14.7-5.77-8.93-10.23-19.12-13.39-30.56-3.16-11.44-4.74-22.38-4.74-32.83 0-14.37 3.65-26.24 10.95-35.61 7.3-9.37 16.4-14.15 27.3-14.34 4.57 0 9.77 1.25 15.6 3.75 5.83 2.5 9.77 3.86 11.83 4.09 1.74-.23 5.88-1.64 12.43-4.22 6.54-2.58 12.04-3.75 16.49-3.51 12.22.61 22.18 4.79 29.88 12.54-10.74 6.53-15.99 15.7-15.75 27.52.24 9.17 3.76 16.89 10.56 23.16 6.8 6.27 15.01 9.87 24.64 10.8-2.22 6.53-4.75 12.73-7.58 18.6zM119.22 33.64c0-7.07 2.61-13.79 7.83-20.16 5.22-6.37 11.66-10.45 19.32-12.24.49 1.22.75 2.56.78 4.02.04 1.46-.14 3.01-.54 4.65-1.57 6.47-4.74 12.39-9.51 17.76-4.77 5.37-10.63 8.79-17.58 10.26-.2-1.46-.3-2.89-.3-4.29z" />
              </svg>
              <span>{loadingProvider === 'apple' ? 'Connecting…' : 'Continue with Apple'}</span>
            </button>

            {/* Continue with Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loadingProvider === 'google'}
              className="w-full min-h-[48px] py-3 px-4 rounded-xl font-mono text-sm font-bold flex items-center justify-center gap-2.5 bg-[#1C1E2D] hover:bg-[#232639] border border-[#30344A] text-white transition-all cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{loadingProvider === 'google' ? 'Connecting…' : 'Continue with Google'}</span>
            </button>
          </div>

          {/* OR Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2A2D42]" />
            </div>
            <span className="relative px-3 bg-[#161824] text-[11px] font-mono font-bold tracking-widest text-[#7E8597] uppercase">
              OR
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailPasswordSignIn} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#8E95A5] uppercase tracking-wider mb-1.5">
                EMAIL
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="you@email.com"
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#0E0F17] border border-[#272A3D] focus:border-[#FFE01A] focus:ring-1 focus:ring-[#FFE01A] text-white placeholder-[#5A6072] text-sm outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-[#8E95A5] uppercase tracking-wider mb-1.5">
                PASSWORD
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="••••••••"
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#0E0F17] border border-[#272A3D] focus:border-[#FFE01A] focus:ring-1 focus:ring-[#FFE01A] text-white placeholder-[#5A6072] text-sm outline-none transition-colors"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                {successMsg}
              </div>
            )}

            {/* Primary Submit Button: SIGN IN → */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] py-3 px-4 rounded-xl font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-[0.99] disabled:opacity-50 mt-1"
              style={{ backgroundColor: accentColor, color: '#000000' }}
            >
              <span>{isSubmitting ? 'SIGNING IN…' : 'SIGN IN →'}</span>
            </button>

            {/* Bottom Links */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[#4EE1A0] hover:underline cursor-pointer min-h-[44px] inline-flex items-center"
              >
                Forgot password?
              </button>

              <button
                type="button"
                onClick={onContinueAsGuest}
                className="text-[#8E95A5] hover:text-white font-medium cursor-pointer min-h-[44px] inline-flex items-center transition-colors"
              >
                Continue as guest
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Signed-in View: Returns straight to profile */
        <div className="bg-[#161824] border border-[#252839] rounded-3xl p-6 sm:p-7 flex flex-col shadow-2xl">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#8E95A5] uppercase block">
                ACCOUNT CONNECTED
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {linkedEmail}
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#9BA1B0] mt-3 leading-relaxed">
            Your taps, places, and combined mileage are connected. Every discovery is automatically synced to your account.
          </p>

          <button
            type="button"
            onClick={onLogin}
            className="w-full min-h-[44px] mt-5 py-2.5 px-4 rounded-xl border border-[#272A3D] hover:border-white/20 bg-[#0E0F17] text-xs font-semibold text-[#8E95A5] hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      )}

      {/* 3. YOUR STATS: 3-UP ROW (TAPS / PLACES / MILES) */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-left">
          <span className="text-xs font-mono font-bold tracking-widest text-[#8E95A5] uppercase">
            YOUR STATS
          </span>
          {isGuest ? (
            <span className="text-xs font-mono text-[#8E95A5] flex items-center gap-1">
              <Lock size={12} className="text-[#8E95A5]" /> Locked
            </span>
          ) : (
            <span className="text-xs font-mono text-[#4ADE80] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" /> Live Connected
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {/* Taps */}
          <div className="bg-[#161826] border border-[#252839] rounded-2xl p-4 flex flex-col items-center justify-center text-center min-h-[96px] relative shadow-sm">
            <span
              className={`text-2xl font-mono font-bold tabular-nums ${
                isGuest ? 'text-[#8E95A5]/40' : 'text-white'
              }`}
            >
              {isGuest ? '—' : realTapsCount}
            </span>
            <span className="text-[11px] font-mono font-bold text-[#8E95A5] uppercase tracking-wider mt-1">
              TAPS
            </span>
          </div>

          {/* Places */}
          <div className="bg-[#161826] border border-[#252839] rounded-2xl p-4 flex flex-col items-center justify-center text-center min-h-[96px] relative shadow-sm">
            <span
              className={`text-2xl font-mono font-bold tabular-nums ${
                isGuest ? 'text-[#8E95A5]/40' : 'text-white'
              }`}
            >
              {isGuest ? '—' : realPlacesCount}
            </span>
            <span className="text-[11px] font-mono font-bold text-[#8E95A5] uppercase tracking-wider mt-1">
              PLACES
            </span>
          </div>

          {/* Miles */}
          <div className="bg-[#161826] border border-[#252839] rounded-2xl p-4 flex flex-col items-center justify-center text-center min-h-[96px] relative shadow-sm">
            <span
              className={`text-2xl font-mono font-bold tabular-nums ${
                isGuest ? 'text-[#8E95A5]/40' : 'text-white'
              }`}
            >
              {isGuest ? '—' : realMilesCount}
            </span>
            <span className="text-[11px] font-mono font-bold text-[#8E95A5] uppercase tracking-wider mt-1">
              MILES
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
