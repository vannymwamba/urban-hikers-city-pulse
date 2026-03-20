import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserRole, UserProfile } from '../types';
import { motion } from 'motion/react';
import { Shield, User as UserIcon, Lock, Mail, ChevronRight, Globe, ArrowLeft } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

interface LoginProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPartnerMode, setIsPartnerMode] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let user;
      if (isRegistering) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        user = res.user;
        
        // Create initial profile
        const profile: UserProfile = {
          uid: user.uid,
          email: user.email!,
          role: isPartnerMode ? 'partner' : 'user'
        };
        try {
          await setDoc(doc(db, 'users', user.uid), profile);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
        onLoginSuccess(profile);
      } else {
        const res = await signInWithEmailAndPassword(auth, email, password);
        user = res.user;
        
        // Fetch profile
        let profileDoc;
        try {
          profileDoc = await getDoc(doc(db, 'users', user.uid));
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          return;
        }
        
        if (profileDoc.exists()) {
          onLoginSuccess(profileDoc.data() as UserProfile);
        } else {
          // Fallback/Create if missing
          const profile: UserProfile = {
            uid: user.uid,
            email: user.email!,
            role: 'user'
          };
          try {
            await setDoc(doc(db, 'users', user.uid), profile);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
          }
          onLoginSuccess(profile);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const user = res.user;

      let profileDoc;
      try {
        profileDoc = await getDoc(doc(db, 'users', user.uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        return;
      }
      
      if (profileDoc.exists()) {
        onLoginSuccess(profileDoc.data() as UserProfile);
      } else {
        const profile: UserProfile = {
          uid: user.uid,
          email: user.email!,
          role: 'user'
        };
        try {
          await setDoc(doc(db, 'users', user.uid), profile);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
        onLoginSuccess(profile);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      
      {/* Back Button */}
      <button 
        onClick={() => {
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        className="absolute top-8 left-8 z-20 flex items-center gap-2 text-hud-green/40 hover:text-hud-green transition-colors text-[10px] font-bold tracking-widest uppercase"
      >
        <ArrowLeft size={16} />
        Back to Home
      </button>

      <div className="max-w-5xl w-full grid md:grid-cols-2 gap-12 items-center relative z-10">
        {/* Left Side: Branding */}
        <div className="hidden md:block">
          <div className="flex items-center gap-4 mb-12">
            <div className="bg-hud-yellow text-black p-3 font-black text-2xl">U</div>
            <div>
              <div className="text-lg font-black tracking-tighter">URBAN HIKERS</div>
              <div className="text-[10px] text-hud-green font-bold tracking-[0.3em]">FLUX PROTOCOL // CIN-OH</div>
            </div>
          </div>

          <h1 className="text-6xl font-black tracking-tighter leading-[0.9] mb-8">
            EMPOWERING URBAN <br />
            <span className="text-hud-yellow">MOBILITY.</span>
          </h1>

          <p className="text-hud-green/60 text-sm max-w-sm leading-relaxed mb-12">
            NFC-enabled discovery network connecting corporate capital to Cincinnati neighborhood vitality. 
            Built for city-scale accountability and neighborhood warmth.
          </p>

          <div className="flex gap-12">
            <div>
              <div className="text-4xl font-black text-hud-yellow">8</div>
              <div className="text-[10px] text-hud-green font-bold tracking-widest uppercase opacity-60">Active Nodes</div>
            </div>
            <div>
              <div className="text-4xl font-black text-hud-yellow">5</div>
              <div className="text-[10px] text-hud-green font-bold tracking-widest uppercase opacity-60">Partners</div>
            </div>
            <div>
              <div className="text-4xl font-black text-hud-yellow">847</div>
              <div className="text-[10px] text-hud-green font-bold tracking-widest uppercase opacity-60">Taps Today</div>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="bg-[#0a0a0a] border border-white/10 p-10 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-hud-yellow" />
          
          <div className="mb-8">
            <div className="text-[10px] text-hud-green font-bold tracking-[0.3em] mb-2">SECURE ACCESS</div>
            <h2 className="text-4xl font-black tracking-tighter">{isRegistering ? 'Sign Up' : 'Login'}</h2>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label className="block text-[10px] text-hud-green/40 font-bold tracking-widest uppercase mb-2">Email Architecture</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-green/40" size={16} />
                <input 
                  type="email"
                  placeholder="you@example.com"
                  className="w-full bg-black border border-white/10 p-4 pl-10 text-sm focus:border-hud-yellow outline-none transition-all"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-hud-green/40 font-bold tracking-widest uppercase mb-2">Cryptographic Pass</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-green/40" size={16} />
                <input 
                  type="password"
                  placeholder="********"
                  className="w-full bg-black border border-white/10 p-4 pl-10 text-sm focus:border-hud-yellow outline-none transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="partnerMode"
                className="accent-hud-yellow"
                checked={isPartnerMode}
                onChange={e => setIsPartnerMode(e.target.checked)}
              />
              <label htmlFor="partnerMode" className="text-[10px] text-hud-green/60 font-bold tracking-widest uppercase cursor-pointer">
                Partner Access Mode
              </label>
            </div>

            {error && (
              <div className="p-3 bg-hud-magenta/10 border border-hud-magenta text-hud-magenta text-[10px] font-bold tracking-widest">
                ERROR: {error.toUpperCase()}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-hud-yellow text-black font-black p-4 hover:bg-hud-yellow/80 transition-all text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2"
            >
              {loading ? 'PROCESSING...' : isRegistering ? 'Create Account' : 'Email Secure Login'}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-hud-green/40"><span className="bg-[#0a0a0a] px-4">Network Auth</span></div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full border border-white/10 p-4 hover:bg-white/5 transition-all text-[10px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-3"
            >
              <Globe size={16} className="text-hud-green" /> Google Network
            </button>
          </form>

          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="mt-8 w-full text-[10px] text-hud-yellow font-bold tracking-widest uppercase hover:underline"
          >
            {isRegistering ? 'Already have an account? Login' : 'Need an account? Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};
