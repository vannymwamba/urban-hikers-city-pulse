import React from 'react';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { Zap, Music, Palette, Calendar, MapPin, ShieldCheck, Home, LayoutGrid, Share2, ArrowRight, Lock } from 'lucide-react';

interface LandingPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
  onLogin: () => void;
  userProfile?: UserProfile | null;
  onOpenWallet?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess, onLogin, userProfile, onOpenWallet }) => {
  // Auto-scroll to signup if accessed via dashboard or login route while not logged in
  React.useEffect(() => {
    const isLoginPath = window.location.pathname.includes('dashboard') || window.location.pathname.includes('login');
    if (isLoginPath && !userProfile) {
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [userProfile]);

  return (
    <div className="bg-[#0A0A0A] text-white font-sans selection:bg-yellow selection:text-black overflow-x-hidden relative min-h-screen">
      {/* Grid Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`, backgroundSize: '40px 40px' }}>
      </div>

      {/* Noise Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")` }}></div>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-[100] px-6 md:px-12 h-20 flex items-center justify-between bg-black/40 backdrop-blur-xl border-b border-white/5">
        <a href="#" className="flex items-center gap-3 no-underline group">
          <div className="w-10 h-10 bg-yellow rounded-full flex items-center justify-center transition-transform group-hover:rotate-12">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="#0A0A0A"/>
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bebas text-2xl tracking-[2px] text-white group-hover:text-yellow transition-colors">Urban Hikers</span>
            <span className="font-mono text-[10px] text-white/40 tracking-[2px] uppercase">Local Pulse</span>
          </div>
        </a>

        <div className="flex items-center gap-4">
          {userProfile ? (
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/dashboard');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="px-6 py-2.5 rounded-full bg-yellow text-black text-[13px] font-bold tracking-[0.5px] hover:scale-105 transition-all shadow-lg"
            >
              Dashboard
            </button>
          ) : (
            <button 
              onClick={onLogin}
              className="px-6 py-2.5 rounded-full border border-white/20 text-white text-[13px] font-bold tracking-[0.5px] hover:bg-white hover:text-black transition-all"
            >
              Login
            </button>
          )}
        </div>
      </nav>

      {/* HERO - Sophisticated Dark Redesign */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center pt-20 overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 mb-12"
        >
          {/* Logo with Walking Figures */}
          <div className="relative w-48 h-48 sm:w-64 sm:h-64 mx-auto mb-12 group">
            <div className="absolute inset-0 bg-white/5 rounded-full border border-white/10 flex items-center justify-center transition-all group-hover:border-yellow/30 group-hover:bg-yellow/5">
              <svg width="60%" height="60%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Walking Figure 1 */}
                <g transform="translate(15, 25) scale(0.7)">
                  <circle cx="25" cy="15" r="8" fill="#FFE01A" />
                  <path d="M25 25 L25 50 L10 75 M25 50 L40 75 M25 35 L10 50 M25 35 L40 50" stroke="#FFE01A" strokeWidth="6" strokeLinecap="round" />
                </g>
                {/* Walking Figure 2 (Backpack) */}
                <g transform="translate(40, 20) scale(0.8)">
                  <circle cx="25" cy="15" r="8" fill="#FFE01A" />
                  <path d="M25 25 L25 50 L15 75 M25 50 L35 75 M25 35 L15 55 M25 35 L35 55" stroke="#FFE01A" strokeWidth="6" strokeLinecap="round" />
                  <rect x="15" y="25" width="10" height="15" rx="2" fill="#FFE01A" />
                </g>
                {/* Walking Figure 3 (Stick) */}
                <g transform="translate(65, 25) scale(0.7)">
                  <circle cx="25" cy="15" r="8" fill="#FFE01A" />
                  <path d="M25 25 L25 50 L10 75 M25 50 L40 75 M25 35 L10 50 M25 35 L40 50" stroke="#FFE01A" strokeWidth="6" strokeLinecap="round" />
                  <path d="M45 30 L45 75" stroke="#FFE01A" strokeWidth="3" strokeLinecap="round" />
                </g>
              </svg>
            </div>
            {/* Animated Ring */}
            <div className="absolute inset-[-10px] border border-yellow/20 rounded-full animate-[spin_20s_linear_infinite]"></div>
          </div>
          
          <h2 className="font-bebas text-5xl sm:text-7xl tracking-[8px] text-white mb-4 uppercase">Urban Hikers</h2>
          <div className="w-32 h-[1px] bg-yellow mx-auto mb-8"></div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="max-w-3xl relative z-10"
        >
          <h1 className="font-bebas text-4xl sm:text-6xl leading-tight tracking-[1px] text-white mb-10">
            WALKING TO INSPIRE <br />
            <span className="text-yellow italic">CURIOSITY OF EXPLORATION</span>
          </h1>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/tap/otr-alpha-01');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="w-full sm:w-auto px-12 py-5 rounded-full bg-yellow text-black font-bold tracking-[2px] hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,224,26,0.3)]"
            >
              TAP INTO THE PULSE
            </button>
            <a 
              href="#how"
              className="w-full sm:w-auto px-12 py-5 rounded-full border border-white/20 text-white font-bold tracking-[2px] hover:bg-white/5 transition-all"
            >
              LEARN MORE
            </a>
          </div>
        </motion.div>

        {/* Floating Text Elements */}
        <div className="absolute bottom-12 left-12 hidden lg:block">
          <div className="font-mono text-[10px] text-white/20 tracking-[4px] uppercase vertical-text rotate-180" style={{ writingMode: 'vertical-rl' }}>
            ESTABLISHED_2026_CINCINNATI
          </div>
        </div>
        <div className="absolute bottom-12 right-12 hidden lg:block">
          <div className="font-mono text-[10px] text-white/20 tracking-[4px] uppercase vertical-text" style={{ writingMode: 'vertical-rl' }}>
            HYPER_LOCAL_CIVIC_OS
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative z-10 px-6 md:px-12 py-16 lg:py-32 border-t border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-2 bg-yellow rounded-full"></div>
          <div className="font-mono text-[10px] tracking-[3px] text-white/40 uppercase">How It Works</div>
        </div>
        <h2 className="font-bebas text-[clamp(40px,5vw,72px)] tracking-[1px] text-white leading-[0.9] mb-6">5 Seconds Digital.<br /><span className="text-white/20">5 Hours Real.</span></h2>
        <p className="text-lg text-white/40 max-w-[520px] leading-[1.6] mb-16">
          We use digital technology for one moment so you can experience your city for the rest of the day. No app download. No account creation. No tracking. Ever.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="group">
            <div className="font-bebas text-[80px] text-white/5 leading-none mb-4 transition-colors group-hover:text-yellow/10">01</div>
            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 transition-all group-hover:border-yellow/30 group-hover:bg-yellow/5">
              <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
                <rect x="4" y="2" width="14" height="18" rx="3" stroke="#FFE01A" strokeWidth="1.5"/>
                <path d="M8 6h6M8 10h4" stroke="#FFE01A" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="11" cy="15" r="1.5" fill="#FFE01A"/>
              </svg>
            </div>
            <div className="text-xl font-bold text-white mb-3 tracking-tight">Tap the Pulse Cube</div>
            <div className="text-sm text-white/40 leading-[1.8]">Find a matte-black Pulse Cube at any of our partner locations. One tap from any phone — NFC built-in, no app needed — opens the live neighborhood feed instantly.</div>
          </div>
          <div className="group">
            <div className="font-bebas text-[80px] text-white/5 leading-none mb-4 transition-colors group-hover:text-yellow/10">02</div>
            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 transition-all group-hover:border-yellow/30 group-hover:bg-yellow/5">
              <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
                <path d="M11 3C7.13 3 4 6.13 4 10c0 5.25 7 12 7 12s7-6.75 7-12c0-3.87-3.13-7-7-7z" stroke="#FFE01A" strokeWidth="1.5" fill="none"/>
                <circle cx="11" cy="10" r="2.5" fill="#FFE01A"/>
              </svg>
            </div>
            <div className="text-xl font-bold text-white mb-3 tracking-tight">See What's Around You</div>
            <div className="text-sm text-white/40 leading-[1.8]">A live 3-mile radius feed loads instantly — flash deals, live events, conference schedules, and civic broadcasts. Every item includes a street address and walking distance.</div>
          </div>
          <div className="group">
            <div className="font-bebas text-[80px] text-white/5 leading-none mb-4 transition-colors group-hover:text-yellow/10">03</div>
            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 transition-all group-hover:border-yellow/30 group-hover:bg-yellow/5">
              <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
                <path d="M11 2L4 7v13h14V7L11 2z" stroke="#FFE01A" strokeWidth="1.5" fill="none"/>
                <path d="M8 20v-7h6v7" stroke="#FFE01A" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-xl font-bold text-white mb-3 tracking-tight">Go Experience the City</div>
            <div className="text-sm text-white/40 leading-[1.8]">Put your phone down. Walk over. The Pulse Cube did its job in 5 seconds. Now it's your turn. Discover the neighborhood businesses, events and culture that surrounds you.</div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="relative z-10 px-6 md:px-12 py-32 bg-white/[0.01] border-y border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-2 bg-yellow rounded-full"></div>
          <div className="font-mono text-[10px] tracking-[3px] text-white/40 uppercase">For Local Businesses</div>
        </div>
        <h2 className="font-bebas text-[clamp(40px,5vw,72px)] tracking-[1px] text-white leading-[0.9] mb-6">Your Storefront<br /><span className="text-white/20">On Every Corner.</span></h2>
        <p className="text-lg text-white/40 max-w-[520px] leading-[1.6] mb-16">
          List your business, publish flash deals, and reach pedestrians who are already within walking distance — with zero ads, zero algorithms, and zero tracking.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="group relative bg-white/[0.02] border border-white/10 rounded-3xl p-10 transition-all hover:border-yellow/20 hover:bg-white/[0.04]">
            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-8 transition-all group-hover:border-yellow/30 group-hover:bg-yellow/5">
              <Zap size={28} className="text-yellow" />
            </div>
            <div className="text-2xl font-bold text-white mb-4 tracking-tight">Flash Deal Broadcast</div>
            <div className="text-base text-white/40 leading-[1.8] mb-8">Push a time-limited deal to every Pulse Cube within your zone. Your offer reaches people who are already on foot, within minutes of your door.</div>
            <div className="flex flex-wrap gap-2">
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-white/5 text-white/40 border border-white/10 tracking-[1px] uppercase">Real-time push</span>
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-white/5 text-white/40 border border-white/10 tracking-[1px] uppercase">Geo-radius targeting</span>
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-yellow/10 text-yellow border border-yellow/20 tracking-[1px] uppercase">$299/mo</span>
            </div>
          </div>

          <div className="group relative bg-white/[0.02] border border-white/10 rounded-3xl p-10 transition-all hover:border-yellow/20 hover:bg-white/[0.04]">
            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-8 transition-all group-hover:border-yellow/30 group-hover:bg-yellow/5">
              <Calendar size={28} className="text-yellow" />
            </div>
            <div className="text-2xl font-bold text-white mb-4 tracking-tight">Event Listings</div>
            <div className="text-base text-white/40 leading-[1.8] mb-8">Publish concerts, pop-ups, workshops, and community gatherings directly into the neighborhood feed. Attach your venue address and let the walk-time calculation do the selling.</div>
            <div className="flex flex-wrap gap-2">
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-white/5 text-white/40 border border-white/10 tracking-[1px] uppercase">Live + scheduled</span>
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-white/5 text-white/40 border border-white/10 tracking-[1px] uppercase">Walk time auto-calc</span>
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-yellow/10 text-yellow border border-yellow/20 tracking-[1px] uppercase">Conference mode</span>
            </div>
          </div>

          <div className="group relative bg-white/[0.02] border border-white/10 rounded-3xl p-10 transition-all hover:border-yellow/20 hover:bg-white/[0.04]">
            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-8 transition-all group-hover:border-yellow/30 group-hover:bg-yellow/5">
              <LayoutGrid size={28} className="text-yellow" />
            </div>
            <div className="text-2xl font-bold text-white mb-4 tracking-tight">Sponsor Node Branding</div>
            <div className="text-base text-white/40 leading-[1.8] mb-8">For enterprise partners — brand an entire Pulse Cube node with your identity. Every tap in your zone surfaces your brand first.</div>
            <div className="flex flex-wrap gap-2">
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-white/5 text-white/40 border border-white/10 tracking-[1px] uppercase">Enterprise tier</span>
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-white/5 text-white/40 border border-white/10 tracking-[1px] uppercase">Node ownership</span>
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-yellow/10 text-yellow border border-yellow/20 tracking-[1px] uppercase">$12K/yr</span>
            </div>
          </div>

          <div className="group relative bg-white/[0.02] border border-white/10 rounded-3xl p-10 transition-all hover:border-yellow/20 hover:bg-white/[0.04]">
            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-8 transition-all group-hover:border-yellow/30 group-hover:bg-yellow/5">
              <ShieldCheck size={28} className="text-yellow" />
            </div>
            <div className="text-2xl font-bold text-white mb-4 tracking-tight">Civic Data Licensing</div>
            <div className="text-base text-white/40 leading-[1.8] mb-8">Aggregate, GPS-free pedestrian flow data — Sidewalk Vibrancy intelligence — licensed to city planners, developers, and civic organizations.</div>
            <div className="flex flex-wrap gap-2">
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-white/5 text-white/40 border border-white/10 tracking-[1px] uppercase">Zero PII collected</span>
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-white/5 text-white/40 border border-white/10 tracking-[1px] uppercase">City planning use</span>
              <span className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-yellow/10 text-yellow border border-yellow/20 tracking-[1px] uppercase">Developer intel</span>
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      <section id="partners" className="px-6 md:px-12 py-32 border-t border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-2 bg-yellow rounded-full"></div>
          <div className="font-mono text-[10px] tracking-[3px] text-white/40 uppercase">Network Expansion</div>
        </div>
        <h2 className="font-bebas text-[clamp(40px,5vw,72px)] tracking-[1px] text-white leading-[0.9] mb-6">Growing the Pulse.</h2>
        <p className="text-lg text-white/40 max-w-[520px] leading-[1.6] mb-16">We are strategically deploying nodes across Cincinnati's most vibrant corridors. Each node anchors a 3-mile radius of hyper-local discovery.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-24">
          {[
            { name: 'Over-the-Rhine', status: 'ACTIVE', nodes: 8, vibe: 'High' },
            { name: 'Northside', status: 'ACTIVE', nodes: 4, vibe: 'Artistic' },
            { name: 'Covington', status: 'EXPANDING', nodes: 2, vibe: 'Riverside' },
            { name: 'Walnut Hills', status: 'UPCOMING', nodes: 0, vibe: 'Historic' }
          ].map((area, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/10 p-8 rounded-3xl hover:border-yellow/20 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className={`text-[9px] font-black px-2 py-0.5 rounded tracking-wider ${
                  area.status === 'ACTIVE' ? 'bg-green text-black' : 'bg-white/10 text-white/40'
                }`}>
                  {area.status}
                </div>
                <div className="text-[10px] font-mono text-white/20 group-hover:text-yellow/60 transition-colors">{area.nodes} NODES</div>
              </div>
              <div className="text-2xl font-bold text-white mb-1 tracking-tight">{area.name}</div>
              <div className="text-xs text-white/20 uppercase tracking-[2px]">{area.vibe} Sector</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-10">
          <div className="w-2 h-2 bg-yellow rounded-full"></div>
          <div className="font-mono text-[10px] tracking-[3px] text-white/40 uppercase">Trusted By</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
          {['KROGER', 'RHINEGEIST', 'BLACK TECH WEEK', 'CONTEMPORARY ARTS CENTER', 'MUSIC HALL', 'FOTOFOCUS'].map((p, i) => (
            <div key={i} className="bg-[#0A0A0A] p-8 flex items-center justify-center font-bebas text-lg tracking-[2px] text-white/20 hover:text-yellow transition-colors text-center">
              {p}
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-6 md:px-12 py-32 bg-white/[0.01] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-12">
            <div className="w-2 h-2 bg-yellow rounded-full"></div>
            <div className="font-mono text-[10px] tracking-[3px] text-white/40 uppercase">Citizen Stories</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="relative">
              <div className="text-[120px] font-bebas text-white/[0.03] absolute -top-16 -left-8 leading-none select-none">"</div>
              <p className="text-2xl font-light text-white/60 leading-relaxed mb-10 italic relative z-10">
                "I was walking through OTR and saw a Pulse Cube. Tapped it, and found a live jazz set happening two blocks away that wasn't on any of my usual apps. It felt like discovering a secret layer of the city."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bebas text-xl text-yellow">MT</div>
                <div>
                  <div className="text-base font-bold text-white">Marcus T.</div>
                  <div className="text-[10px] text-white/20 uppercase tracking-[2px]">Local Explorer</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="text-[120px] font-bebas text-white/[0.03] absolute -top-16 -left-8 leading-none select-none">"</div>
              <p className="text-2xl font-light text-white/60 leading-relaxed mb-10 italic relative z-10">
                "As a business owner, the Pulse Cube has been a game changer. We can push a 30-minute flash deal when we're slow and see people walk in within 5 minutes. It's hyper-local marketing that actually works."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bebas text-xl text-yellow">SL</div>
                <div>
                  <div className="text-base font-bold text-white">Sarah L.</div>
                  <div className="text-[10px] text-white/20 uppercase tracking-[2px]">Skyline Coffee Owner</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 md:px-12 py-32">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-2 h-2 bg-yellow rounded-full"></div>
            <div className="font-mono text-[10px] tracking-[3px] text-white/40 uppercase">Common Questions</div>
          </div>
          <h2 className="font-bebas text-[clamp(40px,5vw,64px)] tracking-[1px] text-white leading-none mb-20 text-center">Everything You Need to Know.</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { q: "Do I really not need an app?", a: "Correct. We use standard NFC technology built into every modern smartphone. Just tap your phone against the Pulse Cube and the live feed opens in your default browser instantly." },
              { q: "How is my privacy protected?", a: "We don't collect GPS data, IP addresses, or personal identifiers. The 'Tap In' creates a temporary anonymous session that expires as soon as you leave the sector or tap out." },
              { q: "Can any business join the network?", a: "We prioritize local, independent businesses that contribute to the unique character of their neighborhood. All partners go through a brief verification process." },
              { q: "What is a Pulse Cube?", a: "It's a matte-black, weather-resistant NFC node installed at partner storefronts and civic hubs. It acts as a physical anchor for the digital layer of the neighborhood." }
            ].map((item, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 hover:bg-white/[0.04] transition-all group">
                <div className="text-lg font-bold text-white mb-4 tracking-tight group-hover:text-yellow transition-colors">{item.q}</div>
                <div className="text-sm text-white/40 leading-relaxed">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SIGNUP CTA */}
      <section id="signup" className="relative z-10 px-6 md:px-12 py-32 text-center border-t border-white/5">
        <div className="max-w-[700px] mx-auto">
          <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-10">
            <div className="w-2 h-2 bg-yellow rounded-full animate-pulse"></div>
            <span className="font-mono text-[10px] font-medium text-white/60 tracking-[2px] uppercase">Now accepting applications · OTR &amp; Northside</span>
          </div>
          <h2 className="font-bebas text-[clamp(48px,8vw,112px)] tracking-[1px] leading-[0.85] text-white mb-8 uppercase">Get Your Business<br /><span className="text-yellow">on the Pulse.</span></h2>
          <p className="text-lg text-white/40 leading-[1.6] mb-12 max-w-[500px] mx-auto">Join the Local Pulse network and reach pedestrians who are already walking past your door — no ad spend, no algorithm, no app required.</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-[500px] mx-auto mb-6">
            <input className="flex-1 p-4 px-6 bg-white/5 border border-white/10 rounded-full text-white font-sans text-sm outline-none focus:border-yellow transition-colors placeholder:text-white/20" type="email" placeholder="Your business email" />
            <button className="bg-yellow text-black px-10 py-4 rounded-full font-bold text-sm whitespace-nowrap hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,224,26,0.2)]">APPLY NOW &rarr;</button>
          </div>
          <div className="font-mono text-[10px] text-white/20 tracking-[1px] uppercase">No spam. We'll respond within 48 hours. Cincinnati businesses only.</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 bg-black border-t border-white/5 px-6 md:px-12 py-20 flex flex-col md:flex-row items-start justify-between gap-12">
        <div className="max-w-xs">
          <div className="font-bebas text-[32px] tracking-[4px] text-white mb-2">Urban Hikers</div>
          <div className="font-mono text-[10px] text-yellow tracking-[3px] uppercase mb-6">Local Pulse OS v1.0</div>
          <div className="text-sm text-white/40 leading-relaxed italic">"Look Up. The City Is Waiting."</div>
        </div>
        <div className="flex flex-col md:items-end gap-8">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <a href="#how" className="font-mono text-[10px] text-white/40 no-underline hover:text-yellow tracking-[2px] uppercase transition-colors">How It Works</a>
            <a href="#services" className="font-mono text-[10px] text-white/40 no-underline hover:text-yellow tracking-[2px] uppercase transition-colors">Services</a>
            <a href="#partners" className="font-mono text-[10px] text-white/40 no-underline hover:text-yellow tracking-[2px] uppercase transition-colors">Partners</a>
            <button 
              onClick={onLogin}
              className="font-mono text-[10px] text-white/40 no-underline hover:text-yellow tracking-[2px] uppercase transition-colors"
            >
              Partner Login
            </button>
          </div>
          <div className="font-mono text-[10px] text-white/20 tracking-[1px] uppercase">&copy; 2026 Urban Hikers · Cincinnati, OH · All nodes anonymous by default</div>
        </div>
      </footer>
    </div>
  );
};
