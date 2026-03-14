import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import { motion } from 'motion/react';
import { Mail, Lock, Globe, Zap, Music, Palette, Calendar, MapPin, ShieldCheck, Home, LayoutGrid, Share2, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
  userProfile?: UserProfile | null;
  onOpenWallet?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess, userProfile, onOpenWallet }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [partnerType, setPartnerType] = useState('Local Business — $299/mo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-scroll to login if accessed via dashboard or login route while not logged in
  React.useEffect(() => {
    const isLoginPath = window.location.pathname.includes('dashboard') || window.location.pathname.includes('login');
    if (isLoginPath && !userProfile) {
      setTimeout(() => {
        const loginSection = document.getElementById('login');
        if (loginSection) {
          loginSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    }
  }, [userProfile]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
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
    <div className="bg-navy-deep text-white font-sans selection:bg-yellow selection:text-navy-deep overflow-x-hidden relative">
      {/* Noise Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-40" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")` }}></div>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-[100] px-6 md:px-12 h-16 flex items-center justify-between bg-navy-deep/85 backdrop-blur-lg border-b border-white/10">
        <a href="#" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 bg-yellow rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L2 5v9h12V5L8 1z" fill="#1A2B4A"/>
              <path d="M5.5 14v-5h5v5" fill="#1A2B4A" opacity=".6"/>
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bebas text-lg tracking-[2px] text-white">Urban Hikers</span>
            <span className="font-mono text-[9px] text-yellow tracking-[2px] uppercase">Local Pulse</span>
          </div>
        </a>

        <ul className="hidden lg:flex items-center gap-8 list-none">
          <li><a href="#how" className="text-[13px] font-medium text-white/45 hover:text-white transition-colors">How It Works</a></li>
          <li><button onClick={onOpenWallet} className="text-[13px] font-medium text-white/45 hover:text-white transition-colors">My Wallet</button></li>
          <li><a href="#services" className="text-[13px] font-medium text-white/45 hover:text-white transition-colors">Services</a></li>
          <li><a href="#partners" className="text-[13px] font-medium text-white/45 hover:text-white transition-colors">Partners</a></li>
          <li><a href="#signup" className="text-[13px] font-medium text-white/45 hover:text-white transition-colors">Get Listed</a></li>
        </ul>

        <div className="flex items-center gap-2.5">
          {userProfile ? (
            <a href="/dashboard" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-yellow text-navy-deep text-[13px] font-bold tracking-[0.3px] hover:bg-[#FFD700] hover:-translate-y-0.5 transition-all">
              Go to Dashboard &rarr;
            </a>
          ) : (
            <>
              <a href="/login" className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-white/20 bg-transparent text-white text-[13px] font-semibold tracking-[0.3px] hover:border-white/50 hover:bg-white/5 transition-all">
                <Lock size={14} />
                Partner Login
              </a>
              <a href="#signup" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-yellow text-navy-deep text-[13px] font-bold tracking-[0.3px] hover:bg-[#FFD700] hover:-translate-y-0.5 transition-all">
                Get Listed &rarr;
              </a>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center px-6 md:px-12 pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(245,200,0,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(245,200,0,0.04)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)]"></div>
        <div className="absolute w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(245,200,0,0.06)_0%,transparent:70%)] -top-1/4 -right-1/4 pointer-events-none"></div>
        <div className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(245,200,0,0.08)_0%,transparent_70%)] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

        <div className="relative z-10 max-w-[720px]">
          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-yellow/10 border border-yellow/25 rounded-full px-3.5 py-1.5 mb-7"
          >
            <div className="w-1.5 h-1.5 bg-yellow rounded-full animate-pulse"></div>
            <span className="font-mono text-[10px] font-medium text-yellow tracking-[2px] uppercase">NFC Civic Infrastructure · Cincinnati, OH</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-bebas text-[clamp(64px,9vw,112px)] leading-[0.92] tracking-[2px] text-white mb-3"
          >
            The City's <span className="text-yellow block">Pulse.</span> One Tap.
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg font-light text-white/45 leading-[1.7] max-w-[500px] mb-10"
          >
            Urban Hikers Local Pulse turns <b className="text-white font-medium">physical NFC nodes</b> into a live city feed —
            flash deals, events, and civic broadcasts. No app. No login. No GPS.
            <b className="text-white font-medium"> Just tap and discover what's happening within walking distance.</b>
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3.5 mb-14"
          >
            {userProfile ? (
              <a href="/dashboard" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-yellow text-navy-deep text-[15px] font-bold tracking-[0.3px] hover:bg-[#FFD700] hover:-translate-y-0.5 transition-all">
                Go to Dashboard
                <ArrowRight size={16} />
              </a>
            ) : (
              <a href="#signup" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-yellow text-navy-deep text-[15px] font-bold tracking-[0.3px] hover:bg-[#FFD700] hover:-translate-y-0.5 transition-all">
                List Your Business
                <ArrowRight size={16} />
              </a>
            )}
            <a href="#how" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/20 bg-transparent text-white text-[15px] font-medium hover:border-white/40 hover:bg-white/5 transition-all">
              See How It Works
            </a>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="flex gap-9 pt-8 border-t border-white/10"
          >
            <div>
              <div className="font-bebas text-4xl text-yellow leading-none tracking-[1px]">12</div>
              <div className="text-xs text-white/45 mt-1 tracking-[0.3px]">Live Nodes · OTR &amp; Northside</div>
            </div>
            <div>
              <div className="font-bebas text-4xl text-yellow leading-none tracking-[1px]">847</div>
              <div className="text-xs text-white/45 mt-1 tracking-[0.3px]">Taps Today</div>
            </div>
            <div>
              <div className="font-bebas text-4xl text-yellow leading-none tracking-[1px]">0</div>
              <div className="text-xs text-white/45 mt-1 tracking-[0.3px]">Data Points Collected</div>
            </div>
          </motion.div>
        </div>

        {/* Phone Mockup */}
        <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-[420px] z-10 hidden xl:block">
          <div className="bg-[#0A1628] rounded-[40px] border border-white/10 p-4 shadow-[0_40px_120px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)]">
            <div className="w-[100px] h-7 bg-[#0A1628] rounded-full mx-auto mb-3 border border-white/5 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-[#1A2B4A] rounded-full"></div>
              <div className="w-10 h-1 bg-[#1A2B4A] rounded-full"></div>
            </div>
            <div className="bg-yellow rounded-[28px] overflow-hidden">
              <div className="bg-yellow px-4 pt-3 pb-2.5 flex justify-between items-center">
                <div className="font-bebas text-base tracking-[2px] text-navy">Urban Hikers</div>
                <div className="flex gap-1">
                  <span className="bg-navy/10 text-navy text-[8px] font-bold px-1.5 py-0.5 rounded-full">No Login</span>
                  <span className="bg-navy/10 text-navy text-[8px] font-bold px-1.5 py-0.5 rounded-full">No GPS</span>
                </div>
              </div>
              <div className="bg-navy p-3.5 pb-3">
                <div className="text-[8px] font-bold tracking-[1.5px] text-white/40 uppercase mb-1 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-green rounded-full"></div>Sector Hub
                </div>
                <div className="font-bebas text-[22px] text-yellow tracking-[1px] mb-2.5">OTR-ALPHA-01</div>
                <div className="flex gap-1.5">
                  <div className="flex-1 bg-green text-[#0D1F14] p-2 rounded-lg text-[9px] font-bold text-center tracking-[0.5px]">Tap In ✓</div>
                  <div className="flex-1 bg-white/10 text-white/35 p-2 rounded-lg text-[9px] font-bold text-center tracking-[0.5px]">Tap Out</div>
                </div>
              </div>
              <div className="bg-[#EEEDE8] p-2.5 px-3">
                <div className="text-[8px] font-extrabold tracking-[2px] text-[#888780] uppercase mb-1.5">Flash Deals</div>
                <div className="bg-white rounded-lg p-2 px-2.5 mb-1.5 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] font-bold text-[#1A1A1A] mb-0.5">⚡ Taco Deal — 50% Off</div>
                    <div className="text-[8px] text-[#888780]">1401 Vine St · 4 min walk</div>
                  </div>
                  <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF3CC] text-[#854F0B]">Buzzing</span>
                </div>
                <div className="text-[8px] font-extrabold tracking-[2px] text-[#888780] uppercase mb-1.5 mt-2">Live Events</div>
                <div className="bg-white rounded-lg p-2 px-2.5 mb-1.5 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] font-bold text-[#1A1A1A] mb-0.5">Live Jazz Quartet</div>
                    <div className="text-[8px] text-[#888780]">Washington Park · 4 min walk</div>
                  </div>
                  <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-[#EAF3DE] text-[#3B6D11]">Chill</span>
                </div>
                <div className="bg-white rounded-lg p-2 px-2.5 mb-1.5 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] font-bold text-[#1A1A1A] mb-0.5">BTW26 — Keynote</div>
                    <div className="text-[8px] text-[#888780]">525 Elm St · 2 min walk</div>
                  </div>
                  <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-[#FCEBEB] text-[#A32D2D]">Live</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative z-10 px-6 md:px-12 py-24">
        <div className="font-mono text-[10px] tracking-[3px] text-yellow uppercase mb-4">How It Works</div>
        <h2 className="font-bebas text-[clamp(40px,5vw,64px)] tracking-[2px] text-white leading-none mb-4">5 Seconds Digital.<br />5 Hours Real.</h2>
        <p className="text-base text-white/45 max-w-[520px] leading-[1.7]">
          We use digital technology for one moment so you can experience your city for the rest of the day. No app download. No account creation. No tracking. Ever.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 mt-14 border border-white/10 rounded-2xl overflow-hidden">
          <div className="bg-white/[0.02] p-10 px-8 border-r border-white/10 hover:bg-white/[0.04] transition-colors">
            <div className="font-bebas text-[56px] text-yellow/15 leading-none mb-4">01</div>
            <div className="w-11 h-11 bg-yellow/10 border border-yellow/20 rounded-xl flex items-center justify-center mb-5">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="4" y="2" width="14" height="18" rx="3" stroke="#F5C800" strokeWidth="1.4"/>
                <path d="M8 6h6M8 10h4" stroke="#F5C800" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="11" cy="15" r="1.5" fill="#F5C800"/>
              </svg>
            </div>
            <div className="text-lg font-bold text-white mb-2.5 leading-tight">Tap the Pulse Cube</div>
            <div className="text-sm text-white/45 leading-[1.7]">Find a matte-black Pulse Cube at any of our partner locations. One tap from any phone — NFC built-in, no app needed — opens the live neighborhood feed instantly.</div>
          </div>
          <div className="bg-white/[0.02] p-10 px-8 border-r border-white/10 hover:bg-white/[0.04] transition-colors">
            <div className="font-bebas text-[56px] text-yellow/15 leading-none mb-4">02</div>
            <div className="w-11 h-11 bg-yellow/10 border border-yellow/20 rounded-xl flex items-center justify-center mb-5">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 3C7.13 3 4 6.13 4 10c0 5.25 7 12 7 12s7-6.75 7-12c0-3.87-3.13-7-7-7z" stroke="#F5C800" strokeWidth="1.4" fill="none"/>
                <circle cx="11" cy="10" r="2.5" fill="#F5C800"/>
              </svg>
            </div>
            <div className="text-lg font-bold text-white mb-2.5 leading-tight">See What's Around You</div>
            <div className="text-sm text-white/45 leading-[1.7]">A live 3-mile radius feed loads instantly — flash deals, live events, conference schedules, and civic broadcasts. Every item includes a street address and walking distance.</div>
          </div>
          <div className="bg-white/[0.02] p-10 px-8 hover:bg-white/[0.04] transition-colors">
            <div className="font-bebas text-[56px] text-yellow/15 leading-none mb-4">03</div>
            <div className="w-11 h-11 bg-yellow/10 border border-yellow/20 rounded-xl flex items-center justify-center mb-5">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 2L4 7v13h14V7L11 2z" stroke="#F5C800" strokeWidth="1.4" fill="none"/>
                <path d="M8 20v-7h6v7" stroke="#F5C800" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-lg font-bold text-white mb-2.5 leading-tight">Go Experience the City</div>
            <div className="text-sm text-white/45 leading-[1.7]">Put your phone down. Walk over. The Pulse Cube did its job in 5 seconds. Now it's your turn. Discover the neighborhood businesses, events and culture that surrounds you.</div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="relative z-10 px-6 md:px-12 py-24 bg-white/[0.015] border-y border-white/10">
        <div className="font-mono text-[10px] tracking-[3px] text-yellow uppercase mb-4">For Local Businesses</div>
        <h2 className="font-bebas text-[clamp(40px,5vw,64px)] tracking-[2px] text-white leading-none mb-4">Your Storefront<br />On Every Corner</h2>
        <p className="text-base text-white/45 max-w-[520px] leading-[1.7]">
          List your business, publish flash deals, and reach pedestrians who are already within walking distance — with zero ads, zero algorithms, and zero tracking.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-14">
          <div className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-8 transition-all hover:border-yellow/20 hover:bg-yellow/[0.03]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-yellow scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
            <div className="w-12 h-12 bg-yellow/10 border border-yellow/20 rounded-xl flex items-center justify-center mb-5">
              <Zap size={24} className="text-yellow" />
            </div>
            <div className="text-xl font-bold text-white mb-2.5">Flash Deal Broadcast</div>
            <div className="text-sm text-white/45 leading-[1.7] mb-5">Push a time-limited deal to every Pulse Cube within your zone. Your offer reaches people who are already on foot, within minutes of your door. Set it, activate it, watch them walk in.</div>
            <div className="flex flex-wrap gap-1.5">
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">Real-time push</span>
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">Geo-radius targeting</span>
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">$299/mo</span>
            </div>
          </div>

          <div className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-8 transition-all hover:border-yellow/20 hover:bg-yellow/[0.03]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-yellow scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
            <div className="w-12 h-12 bg-yellow/10 border border-yellow/20 rounded-xl flex items-center justify-center mb-5">
              <Calendar size={24} className="text-yellow" />
            </div>
            <div className="text-xl font-bold text-white mb-2.5">Event Listings</div>
            <div className="text-sm text-white/45 leading-[1.7] mb-5">Publish concerts, pop-ups, workshops, and community gatherings directly into the neighborhood feed. Attach your venue address and let the walk-time calculation do the selling for you.</div>
            <div className="flex flex-wrap gap-1.5">
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">Live + scheduled</span>
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">Walk time auto-calc</span>
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">Conference mode</span>
            </div>
          </div>

          <div className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-8 transition-all hover:border-yellow/20 hover:bg-yellow/[0.03]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-yellow scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
            <div className="w-12 h-12 bg-yellow/10 border border-yellow/20 rounded-xl flex items-center justify-center mb-5">
              <LayoutGrid size={24} className="text-yellow" />
            </div>
            <div className="text-xl font-bold text-white mb-2.5">Sponsor Node Branding</div>
            <div className="text-sm text-white/45 leading-[1.7] mb-5">For enterprise partners — brand an entire Pulse Cube node with your identity. Every tap in your zone surfaces your brand first. Used by Kroger, Medpace, and corporate event sponsors to anchor the network.</div>
            <div className="flex flex-wrap gap-1.5">
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">Enterprise tier</span>
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">Node ownership</span>
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">$12K/yr per node</span>
            </div>
          </div>

          <div className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-8 transition-all hover:border-yellow/20 hover:bg-yellow/[0.03]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-yellow scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
            <div className="w-12 h-12 bg-yellow/10 border border-yellow/20 rounded-xl flex items-center justify-center mb-5">
              <ShieldCheck size={24} className="text-yellow" />
            </div>
            <div className="text-xl font-bold text-white mb-2.5">Civic Data Licensing</div>
            <div className="text-sm text-white/45 leading-[1.7] mb-5">Aggregate, GPS-free pedestrian flow data — Sidewalk Vibrancy intelligence — licensed to city planners, developers, and civic organizations. No personal data is ever collected. Pattern data only.</div>
            <div className="flex flex-wrap gap-1.5">
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">Zero PII collected</span>
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">City planning use</span>
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/45 border border-white/10 tracking-[0.5px]">Developer intelligence</span>
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      <section id="partners" className="px-6 md:px-12 py-24 border-t border-white/10">
        <div className="font-mono text-[10px] tracking-[3px] text-yellow uppercase mb-4">Network Expansion</div>
        <h2 className="font-bebas text-[clamp(40px,5vw,64px)] tracking-[2px] text-white leading-none mb-4">Growing the Pulse.</h2>
        <p className="text-base text-white/45 max-w-[520px] leading-[1.7] mb-12">We are strategically deploying nodes across Cincinnati's most vibrant corridors. Each node anchors a 3-mile radius of hyper-local discovery.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-16">
          {[
            { name: 'Over-the-Rhine', status: 'ACTIVE', nodes: 8, vibe: 'High' },
            { name: 'Northside', status: 'ACTIVE', nodes: 4, vibe: 'Artistic' },
            { name: 'Covington', status: 'EXPANDING', nodes: 2, vibe: 'Riverside' },
            { name: 'Walnut Hills', status: 'UPCOMING', nodes: 0, vibe: 'Historic' }
          ].map((area, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl hover:border-yellow/20 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className={`text-[9px] font-black px-2 py-0.5 rounded ${
                  area.status === 'ACTIVE' ? 'bg-green text-navy-deep' : 'bg-white/10 text-white/40'
                }`}>
                  {area.status}
                </div>
                <div className="text-[10px] font-mono text-yellow/40">{area.nodes} NODES</div>
              </div>
              <div className="text-xl font-bold text-white mb-1">{area.name}</div>
              <div className="text-xs text-white/30 uppercase tracking-widest">{area.vibe} Sector</div>
            </div>
          ))}
        </div>

        <div className="font-mono text-[10px] tracking-[3px] text-yellow uppercase mb-4">Trusted By</div>
        <div className="flex flex-col md:flex-row items-stretch gap-0 border border-white/10 rounded-xl overflow-hidden">
          {['KROGER', 'MEDPACE', 'BLACK TECH WEEK', 'HEART OF NORTHSIDE', 'STRONG TOWNS', 'BLINK CINCINNATI'].map((p, i) => (
            <div key={i} className="flex-1 p-7 px-5 border-r border-white/10 flex items-center justify-center font-bebas text-lg tracking-[2px] text-white/25 hover:text-yellow/60 transition-colors last:border-r-0">
              {p}
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-6 md:px-12 py-24 bg-white/[0.01] border-y border-white/10">
        <div className="max-w-4xl mx-auto">
          <div className="font-mono text-[10px] tracking-[3px] text-yellow uppercase mb-8 text-center">Citizen Stories</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="relative">
              <div className="text-[80px] font-bebas text-yellow/10 absolute -top-10 -left-4 leading-none select-none">"</div>
              <p className="text-xl font-light text-white/80 leading-relaxed mb-6 italic">
                "I was walking through OTR and saw a Pulse Cube. Tapped it, and found a live jazz set happening two blocks away that wasn't on any of my usual apps. It felt like discovering a secret layer of the city."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow/20 border border-yellow/30"></div>
                <div>
                  <div className="text-sm font-bold text-white">Marcus T.</div>
                  <div className="text-[10px] text-white/40 uppercase tracking-widest">Local Explorer</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="text-[80px] font-bebas text-yellow/10 absolute -top-10 -left-4 leading-none select-none">"</div>
              <p className="text-xl font-light text-white/80 leading-relaxed mb-6 italic">
                "As a business owner, the Pulse Cube has been a game changer. We can push a 30-minute flash deal when we're slow and see people walk in within 5 minutes. It's hyper-local marketing that actually works."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow/20 border border-yellow/30"></div>
                <div>
                  <div className="text-sm font-bold text-white">Sarah L.</div>
                  <div className="text-[10px] text-white/40 uppercase tracking-widest">Skyline Coffee Owner</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 md:px-12 py-24">
        <div className="max-w-3xl mx-auto">
          <div className="font-mono text-[10px] tracking-[3px] text-yellow uppercase mb-4 text-center">Common Questions</div>
          <h2 className="font-bebas text-[48px] tracking-[2px] text-white leading-none mb-12 text-center">Everything You Need to Know.</h2>
          
          <div className="space-y-4">
            {[
              { q: "Do I really not need an app?", a: "Correct. We use standard NFC technology built into every modern smartphone. Just tap your phone against the Pulse Cube and the live feed opens in your default browser instantly." },
              { q: "How is my privacy protected?", a: "We don't collect GPS data, IP addresses, or personal identifiers. The 'Tap In' creates a temporary anonymous session that expires as soon as you leave the sector or tap out. We only track aggregate 'vibrancy' patterns." },
              { q: "Can any business join the network?", a: "We prioritize local, independent businesses that contribute to the unique character of their neighborhood. All partners go through a brief verification process to ensure high-quality broadcasts." },
              { q: "What is a Pulse Cube?", a: "It's a matte-black, weather-resistant NFC node installed at partner storefronts and civic hubs. It acts as a physical anchor for the digital layer of the neighborhood." }
            ].map((item, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-6 hover:bg-white/[0.05] transition-all">
                <div className="text-lg font-bold text-white mb-2">{item.q}</div>
                <div className="text-sm text-white/45 leading-relaxed">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARTNER LOGIN */}
      <section id="login" className="px-6 md:px-12 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-white/10 rounded-[20px] overflow-hidden">
          <div className="bg-yellow p-14 px-12 flex flex-col justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-[2px] text-navy/60 uppercase mb-5">Partner Portal</div>
              <h2 className="font-bebas text-[52px] text-navy-deep leading-[0.95] tracking-[2px] mb-5">Activate Your NFC Node.</h2>
              <p className="text-[15px] text-navy/65 leading-[1.7] max-w-[340px]">Log in to your partner dashboard to publish flash deals, manage event listings, view tap analytics, and control your Pulse Cube zone in real time.</p>
            </div>
            <div className="flex flex-col gap-3 mt-9">
              {['Publish flash deals instantly', 'View live tap analytics', 'Manage event listings', 'Control your node zone', 'Download impact reports'].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 bg-navy-deep rounded-full flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#F5C800" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span className="text-[13px] font-semibold text-navy-deep">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0D1825] p-14 px-12 flex flex-col justify-center">
            <h2 className="font-bebas text-[28px] tracking-[2px] text-white mb-2">Partner Login</h2>
            <p className="text-[13px] text-white/45 mb-8">Access your Local Pulse portal</p>

            <form onSubmit={handleLogin}>
              <div className="mb-[18px]">
                <label className="font-mono text-[10px] tracking-[1.5px] text-white/40 uppercase mb-2 block">Business Email</label>
                <input 
                  className="w-full p-[13px] px-4 bg-white/5 border border-white/10 rounded-lg text-white font-sans text-sm outline-none focus:border-yellow transition-colors placeholder:text-white/20" 
                  type="email" 
                  placeholder="hello@yourbusiness.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="mb-[18px]">
                <label className="font-mono text-[10px] tracking-[1.5px] text-white/40 uppercase mb-2 block">Password</label>
                <input 
                  className="w-full p-[13px] px-4 bg-white/5 border border-white/10 rounded-lg text-white font-sans text-sm outline-none focus:border-yellow transition-colors placeholder:text-white/20" 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="mb-[18px]">
                <label className="font-mono text-[10px] tracking-[1.5px] text-white/40 uppercase mb-2 block">Partner Type</label>
                <select 
                  className="w-full p-[13px] px-4 bg-white/5 border border-white/10 rounded-lg text-white font-sans text-sm outline-none cursor-pointer focus:border-yellow transition-colors"
                  value={partnerType}
                  onChange={e => setPartnerType(e.target.value)}
                >
                  <option>Local Business — $299/mo</option>
                  <option>Event Organizer</option>
                  <option>Sponsor Node — Enterprise</option>
                  <option>Civic / Nonprofit</option>
                  <option>Conference Partner</option>
                </select>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-hud-magenta/10 border border-hud-magenta text-hud-magenta text-[10px] font-bold tracking-widest uppercase">
                  ERROR: {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full p-3.5 bg-yellow text-navy-deep rounded-lg font-bold text-[15px] tracking-[0.3px] mt-2 hover:bg-[#FFD700] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'PROCESSING...' : 'Activate Portal'}
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-[1px] bg-white/10"></div>
              <span className="text-[11px] text-white/25">or</span>
              <div className="flex-1 h-[1px] bg-white/10"></div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full p-[13px] bg-transparent text-green border border-green/30 rounded-lg font-semibold text-sm hover:bg-green/5 hover:border-green/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Globe size={18} />
              Google Network Login
            </button>

            <div className="text-[11px] text-white/25 text-center mt-5 leading-[1.6]">
              New partner? <a href="#signup" className="text-yellow no-underline">Apply for access &rarr;</a><br />
              Forgot your credentials? <a href="#" className="text-yellow no-underline">Contact support</a>
            </div>
          </div>
        </div>
      </section>

      {/* SIGNUP CTA */}
      <section id="signup" className="relative z-10 px-6 md:px-12 py-24 text-center">
        <div className="max-w-[600px] mx-auto">
          <div className="inline-flex items-center gap-2 bg-yellow/10 border border-yellow/25 rounded-full px-3.5 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-yellow rounded-full animate-pulse"></div>
            <span className="font-mono text-[10px] font-medium text-yellow tracking-[2px] uppercase">Now accepting applications · OTR &amp; Northside</span>
          </div>
          <h2 className="font-bebas text-[clamp(48px,6vw,80px)] tracking-[2px] leading-[0.95] text-white mb-5">Get Your Business<br />on the <span className="text-yellow">Pulse.</span></h2>
          <p className="text-base text-white/45 leading-[1.7] mb-9">Join the Local Pulse network and reach pedestrians who are already walking past your door — no ad spend, no algorithm, no app required.</p>
          <div className="flex flex-col sm:flex-row gap-2.5 max-w-[440px] mx-auto mb-4">
            <input className="flex-1 p-3.5 px-[18px] bg-white/5 border border-white/10 rounded-lg text-white font-sans text-sm outline-none focus:border-yellow transition-colors placeholder:text-white/25" type="email" placeholder="Your business email" />
            <button className="bg-yellow text-navy-deep px-6 py-3.5 rounded-lg font-bold text-sm whitespace-nowrap hover:bg-[#FFD700] transition-all">Apply Now &rarr;</button>
          </div>
          <div className="text-[11px] text-white/20">No spam. We'll respond within 48 hours. Cincinnati businesses only for Phase 1.</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 bg-navy-deep border-t border-white/10 px-6 md:px-12 py-12 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="text-center md:text-left">
          <div className="font-bebas text-[22px] tracking-[3px] text-white">Urban Hikers</div>
          <div className="font-mono text-[9px] text-yellow tracking-[2px] uppercase mt-0.5">Local Pulse OS v1.0</div>
          <div className="text-[13px] text-white/45 mt-3">"Look Up. The City Is Waiting."</div>
        </div>
        <div className="text-center md:text-right">
          <div className="flex flex-wrap justify-center md:justify-end gap-6 mb-3">
            <a href="#how" className="text-xs text-white/45 no-underline hover:text-white transition-colors">How It Works</a>
            <a href="#services" className="text-xs text-white/45 no-underline hover:text-white transition-colors">Services</a>
            <a href="#partners" className="text-xs text-white/45 no-underline hover:text-white transition-colors">Partners</a>
            <a href="/login" className="text-xs text-white/45 no-underline hover:text-white transition-colors">Partner Login</a>
            <a href="#" className="text-xs text-white/45 no-underline hover:text-white transition-colors">Privacy Promise</a>
          </div>
          <div className="text-[11px] text-white/20">&copy; 2026 Urban Hikers · Cincinnati, OH · All nodes anonymous by default</div>
        </div>
      </footer>
    </div>
  );
};
