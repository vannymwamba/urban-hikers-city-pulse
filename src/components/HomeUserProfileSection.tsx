import React, { useState, useEffect } from 'react';
import { Lock, LogOut, CheckCircle2, User, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { upgradeWithGoogle, linkEmailWithPassword, resetPassword } from '../utils/identityUpgrade';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import type { UserProfile, VisitorProfile } from '../types';



interface HomeUserProfileSectionProps {
  user: any;
  userProfile: UserProfile | null;
  accentColor?: string;
  onLogin: () => void;
  onProfileUpdate?: (profile: UserProfile) => void;
  nodesVisitedCount?: number;
  hubsTappedCount?: number;
  totalMiles?: number;
}

export const HomeUserProfileSection: React.FC<HomeUserProfileSectionProps> = ({
  user,
  userProfile,
  accentColor = '#FFE01A',
  onLogin,
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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

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
    0;

  const realPlacesCount =
    visitorProfileData?.locations_visited_ids?.length ||
    (visitorProfileData?.journey_stops?.length ? Math.min(visitorProfileData.journey_stops.length, 1) : 0);

  const realMilesCount =
    visitorProfileData?.total_miles_explored != null
      ? Number(visitorProfileData.total_miles_explored).toFixed(1)
      : (totalMiles ? totalMiles.toFixed(1) : '0.0');


  // Google Instant Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
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
      setIsGoogleLoading(false);
    }
  };

  // Email + Password Instant Sign-In
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
      setSuccessMsg('Account connected! Your taps are permanently saved.');
      if (onProfileUpdate) {
        onProfileUpdate(profile);
      }
    } catch (err: any) {
      console.error('Email sign in error:', err);
      if (err?.code === 'auth/email-already-in-use') {
        setErrorMsg('Email already in use. Try signing in with Google or reset password.');
      } else if (err?.code === 'auth/wrong-password') {
        setErrorMsg('Incorrect password. Please try again.');
      } else {
        setErrorMsg(err?.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogOut = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4 mt-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#FFE01A]/10 border border-[#FFE01A]/30 flex items-center justify-center text-[#FFE01A]">
            <User size={15} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold tracking-[0.18em] text-[#FFE01A] uppercase block">
              EXPLORER PROFILE
            </span>
            <h3 className="text-[19px] font-black text-white uppercase tracking-tight leading-none mt-0.5">
              Your Stats
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[10px] font-mono font-bold uppercase tracking-wider">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isGuest ? 'bg-[#A3A3AA]' : 'bg-[#4ADE80] animate-pulse'
            }`}
          />
          <span className={isGuest ? 'text-[#A3A3AA]' : 'text-[#4ADE80]'}>
            {isGuest ? 'Guest Pass' : 'Connected'}
          </span>
        </div>
      </div>

      {/* 1. Account State Card */}
      {isGuest ? (
        <div className="bg-[#141417] border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col gap-3.5">
          <div>
            <h4 className="text-base font-black text-white uppercase tracking-tight">
              Save Your Walk Record
            </h4>
            <p className="text-xs text-[#8E95A5] mt-1 leading-relaxed">
              Sign in with one tap to preserve your tap count, unlocked badges, and leaderboard ranking across devices.
            </p>
          </div>

          {/* Continue with Google button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2.5 bg-[#1C1E2D] hover:bg-[#232639] border border-[#30344A] text-white transition-all cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{isGoogleLoading ? 'Connecting Google…' : 'Continue with Google'}</span>
          </button>

          {/* Toggle Email Form */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
            <button
              type="button"
              onClick={() => setShowEmailForm(!showEmailForm)}
              className="text-[#8E95A5] hover:text-white flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider py-1 cursor-pointer transition-colors"
            >
              <span>{showEmailForm ? 'Hide Email Sign-in' : 'Or Sign in with Email'}</span>
              {showEmailForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <span className="text-[10px] font-mono text-[#8E95A5] uppercase">
              Instant Sync
            </span>
          </div>

          {showEmailForm && (
            <form onSubmit={handleEmailPasswordSignIn} className="flex flex-col gap-2.5 pt-1 animate-in fade-in duration-200">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full min-h-[42px] px-3.5 rounded-lg bg-[#0E0F17] border border-[#272A3D] text-white placeholder-[#5A6072] text-xs outline-none focus:border-[#FFE01A]"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 6 chars)"
                className="w-full min-h-[42px] px-3.5 rounded-lg bg-[#0E0F17] border border-[#272A3D] text-white placeholder-[#5A6072] text-xs outline-none focus:border-[#FFE01A]"
              />
              {errorMsg && <p className="text-[11px] text-red-400">{errorMsg}</p>}
              {successMsg && <p className="text-[11px] text-emerald-400">{successMsg}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ backgroundColor: accentColor, color: '#000' }}
                className="w-full min-h-[44px] rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? 'Signing in…' : 'Sign in & Connect'}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="bg-[#141417] border border-white/10 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-[#FFE01A]/30"
              style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-mono font-bold tracking-widest text-[#8E95A5] uppercase block">
                ACCOUNT CONNECTED
              </span>
              <h4 className="text-sm font-bold text-white truncate">
                {linkedEmail}
              </h4>
              <span className="text-[10px] text-[#4ADE80] font-mono flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
                Live synced to leaderboard
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogOut}
            disabled={isSubmitting}
            className="px-3.5 py-2 rounded-xl border border-white/10 hover:border-red-500/30 bg-white/[0.04] hover:bg-red-500/10 text-[11px] font-mono font-bold text-[#A3A3AA] hover:text-red-400 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Log out of your account"
          >
            <LogOut size={13} />
            <span>Log out</span>
          </button>
        </div>
      )}

      {/* 2. 3-Up Stats Row (Taps / Places / Miles) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* Taps */}
        <div className="bg-[#141417] border border-white/10 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center min-h-[90px] relative shadow-md">
          <span className="text-2xl font-mono font-black text-[#FFE01A] tabular-nums">
            {realTapsCount}
          </span>
          <span className="text-[10px] font-mono font-bold text-[#8E95A5] uppercase tracking-wider mt-0.5">
            TAPS
          </span>
        </div>

        {/* Places */}
        <div className="bg-[#141417] border border-white/10 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center min-h-[90px] relative shadow-md">
          <span className="text-2xl font-mono font-black text-white tabular-nums">
            {realPlacesCount}
          </span>
          <span className="text-[10px] font-mono font-bold text-[#8E95A5] uppercase tracking-wider mt-0.5">
            PLACES
          </span>
        </div>

        {/* Miles */}
        <div className="bg-[#141417] border border-white/10 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center min-h-[90px] relative shadow-md">
          <span className="text-2xl font-mono font-black text-white tabular-nums">
            {realMilesCount}
          </span>
          <span className="text-[10px] font-mono font-bold text-[#8E95A5] uppercase tracking-wider mt-0.5">
            MILES
          </span>
        </div>
      </div>
    </div>
  );
};
