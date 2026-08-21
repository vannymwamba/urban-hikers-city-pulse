import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Loader2, Save } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import type { GlobalSponsors } from '../types';

interface AdminGlobalSponsorsPanelProps {
  setHudMessage: (msg: { text: string; type: 'info' | 'error' } | null) => void;
}

export function AdminGlobalSponsorsPanel({ setHudMessage }: AdminGlobalSponsorsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<GlobalSponsors>({
    hero: { name: '', link: '', logoUrl: '' },
    wayfinding: { name: '', link: '', logoUrl: '' },
    lostAndFound: { name: '', link: '', logoUrl: '' },
    footer: { name: '', link: '', logoUrl: '' }
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'globalSponsors', 'config'));
        if (snap.exists()) {
          const data = snap.data() as GlobalSponsors;
          setFormData({
            hero: data.hero || { name: '', link: '', logoUrl: '' },
            wayfinding: data.wayfinding || { name: '', link: '', logoUrl: '' },
            lostAndFound: data.lostAndFound || { name: '', link: '', logoUrl: '' },
            footer: data.footer || { name: '', link: '', logoUrl: '' }
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSubmitting(true);
    
    // Clean up empty fields to null for DisplaySponsor type
    const cleanSponsor = (sp: any) => {
      if (!sp || !sp.name) return null;
      return {
        name: sp.name,
        link: sp.link || '',
        logoUrl: sp.logoUrl || ''
      };
    };

    const payload = {
      hero: cleanSponsor(formData.hero),
      wayfinding: cleanSponsor(formData.wayfinding),
      lostAndFound: cleanSponsor(formData.lostAndFound),
      footer: cleanSponsor(formData.footer),
    };

    try {
      await setDoc(doc(db, 'globalSponsors', 'config'), payload);
      setHudMessage({ text: 'Global sponsors updated successfully', type: 'info' });
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'globalSponsors');
      setHudMessage({ text: 'Failed to save global sponsors', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (section: keyof GlobalSponsors, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#999]" /></div>;

  const sections = [
    { id: 'hero', label: 'Hero (Presented by)' },
    { id: 'wayfinding', label: 'Wayfinding (Walk There)' },
    { id: 'lostAndFound', label: 'Lost & Found' },
    { id: 'footer', label: 'Footer (The City Talks)' }
  ] as const;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[12px] font-bold tracking-widest uppercase text-[#999]">GLOBAL_SPONSORS_CONFIG</h3>
        <button 
          onClick={handleSave}
          disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 bg-black text-[#FFE01A] text-[9px] font-black tracking-widest uppercase rounded-lg hover:scale-105 transition-all disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save size={12} />}
          {submitting ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-2xl p-8 mb-8 space-y-8">
        {sections.map(section => (
          <div key={section.id} className="border-b border-[#e0e0e0] pb-6 last:border-0 last:pb-0">
            <h4 className="text-xs font-black uppercase tracking-widest mb-4 text-black">{section.label}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Sponsor Name</label>
                <input 
                  value={formData[section.id]?.name || ''} 
                  onChange={e => updateField(section.id, 'name', e.target.value)} 
                  className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" 
                  placeholder="Leave empty to hide slot" 
                />
              </div>
              <div>
                <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Target URL</label>
                <input 
                  value={formData[section.id]?.link || ''} 
                  onChange={e => updateField(section.id, 'link', e.target.value)} 
                  className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" 
                  placeholder="https://..." 
                />
              </div>
              <div>
                <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Logo Image URL</label>
                <input 
                  value={formData[section.id]?.logoUrl || ''} 
                  onChange={e => updateField(section.id, 'logoUrl', e.target.value)} 
                  className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" 
                  placeholder="https://..." 
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
