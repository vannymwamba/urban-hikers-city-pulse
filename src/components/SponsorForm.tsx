import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Rocket, ShieldCheck, CreditCard, ArrowLeft, Image as ImageIcon, Link as LinkIcon, MapPin } from 'lucide-react';

export const SponsorForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    campaign_title: '',
    cover_url: '',
    cta_url: '',
    cta_label: 'Learn More',
    location_label: '',
    tier: 'standard'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/create-sponsor-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to initialize checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-uh-black text-white p-6 font-sans">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft />
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Ignite_Sponsorship</h1>
          <p className="text-[10px] text-uh-yellow font-bold tracking-widest uppercase opacity-80">Flash_Rotation_System // Protocol_v1</p>
        </div>
      </header>

      <div className="max-w-md mx-auto">
        <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-uh-yellow flex items-center justify-center">
              <Rocket className="text-uh-black" size={20} />
            </div>
            <div>
              <div className="text-uh-yellow font-black text-xs uppercase tracking-widest">Global_Reach</div>
              <div className="text-[10px] text-white/40 font-bold uppercase">Activate your signal across all hubs.</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black text-uh-yellow uppercase tracking-widest ml-1">Campaign_Title</label>
              <div className="relative">
                <input 
                  required
                  placeholder="e.g. Half-price OTR Walking Tour"
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-uh-yellow transition-all outline-none"
                  value={formData.campaign_title}
                  onChange={e => setFormData({...formData, campaign_title: e.target.value})}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black text-uh-yellow uppercase tracking-widest ml-1">Cover_Image_URL</label>
              <div className="relative">
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input 
                  required
                  type="url"
                  placeholder="https://..."
                  className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-2xl text-sm focus:border-uh-yellow transition-all outline-none"
                  value={formData.cover_url}
                  onChange={e => setFormData({...formData, cover_url: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-uh-yellow uppercase tracking-widest ml-1">CTA_Label</label>
                <input 
                  required
                  placeholder="e.g. Book Spot"
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:border-uh-yellow transition-all outline-none"
                  value={formData.cta_label}
                  onChange={e => setFormData({...formData, cta_label: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-uh-yellow uppercase tracking-widest ml-1">Location_Label</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                  <input 
                    required
                    placeholder="e.g. Vine St · OTR"
                    className="w-full bg-white/5 border border-white/10 p-4 pl-11 rounded-2xl text-sm focus:border-uh-yellow transition-all outline-none"
                    value={formData.location_label}
                    onChange={e => setFormData({...formData, location_label: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black text-uh-yellow uppercase tracking-widest ml-1">Destination_URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input 
                  required
                  type="url"
                  placeholder="https://..."
                  className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-2xl text-sm focus:border-uh-yellow transition-all outline-none"
                  value={formData.cta_url}
                  onChange={e => setFormData({...formData, cta_url: e.target.value})}
                />
              </div>
            </div>

            <div className="mt-4 p-4 bg-uh-yellow/5 border border-uh-yellow/20 rounded-2xl">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-uh-yellow">Tier: Standard_Slot</span>
                <span className="text-xl font-black tracking-tighter">$49.00</span>
              </div>
              <div className="text-[9px] text-white/40 font-bold uppercase">24HR ROTATION ACROSS ALL ACTIVE HUBS</div>
            </div>

            <button
              disabled={loading}
              className="w-full bg-uh-yellow text-uh-black p-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-uh-black/20 border-t-uh-black rounded-full animate-spin" />
              ) : (
                <>
                  <CreditCard size={18} />
                  <span>Launch_Signal</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="flex items-center gap-4 px-4 opacity-50">
          <ShieldCheck size={16} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Secure_Stripe_Payment_Channel</span>
        </div>
      </div>
    </div>
  );
};

export const SponsorSuccess: React.FC = () => (
  <div className="min-h-screen bg-uh-black text-white flex flex-col items-center justify-center p-8 text-center">
    <div className="w-20 h-20 bg-uh-teal rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(45,212,191,0.2)]">
      <Rocket className="text-uh-black" size={32} />
    </div>
    <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Signal_Launched</h1>
    <p className="text-sm text-white/60 mb-8 max-w-xs">Your campaign has been verified and will be live across the network within 60 seconds.</p>
    <button 
      onClick={() => window.location.href = '/'}
      className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors"
    >
      Return_to_Hub
    </button>
  </div>
);

export const SponsorCancelled: React.FC = () => (
  <div className="min-h-screen bg-uh-black text-white flex flex-col items-center justify-center p-8 text-center">
    <div className="w-20 h-20 bg-uh-magenta/20 rounded-full flex items-center justify-center mb-6">
      <CreditCard className="text-uh-magenta" size={32} />
    </div>
    <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Payment_Terminated</h1>
    <p className="text-sm text-white/60 mb-8 max-w-xs">The transaction was cancelled. Your sponsorship slot has not been activated.</p>
    <div className="flex flex-col gap-3 w-full max-w-xs">
      <button 
        onClick={() => window.location.href = '/sponsor/ignite'}
        className="w-full py-4 bg-uh-yellow text-uh-black rounded-2xl font-black text-xs uppercase tracking-widest"
      >
        Try_Again
      </button>
      <button 
        onClick={() => window.location.href = '/'}
        className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest"
      >
        Abort_Mission
      </button>
    </div>
  </div>
);
