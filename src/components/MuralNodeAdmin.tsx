import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, 
  MapPin, 
  User, 
  Type, 
  FileText, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft,
  Search,
  Image as ImageIcon
} from 'lucide-react';
import { LocalPulseLoader } from './LocalPulseLoader';

const MuralNodeAdmin: React.FC = () => {
  const [muralName, setMuralName] = useState('');
  const [artist, setArtist] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | ''>('');
  const [longitude, setLongitude] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const generateId = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  const resolveCoords = async () => {
    if (!address) {
      setStatus({ type: 'error', message: 'ENTER_ADDRESS_FIRST' });
      return;
    }

    setIsResolving(true);
    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'SERVER_ERROR' }));
        throw new Error(errorData.error || 'GEOCODING_FAILED');
      }

      const data = await response.json();

      if (data && data.lat && data.lon) {
        setLatitude(parseFloat(data.lat));
        setLongitude(parseFloat(data.lon));
        setStatus({ type: 'success', message: 'COORDS_RESOLVED' });
      } else {
        throw new Error('ADDRESS_NOT_FOUND');
      }
    } catch (err: any) {
      console.error('Geocoding error:', err);
      setStatus({ 
        type: 'error', 
        message: `GEOCODING_FAILED: ${err.message || 'UNKNOWN_ERROR'}` 
      });
    } finally {
      setIsResolving(false);
    }
  };

  const handleDeployMural = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!muralName || !artist || !address || latitude === '' || longitude === '' || !imageUrl) {
      setStatus({ type: 'error', message: 'INCOMPLETE_PAYLOAD' });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    const id = generateId(muralName);

    try {
      // Save to Firestore
      const muralData = {
        id,
        name: muralName,
        artist,
        address,
        latitude: Number(latitude),
        longitude: Number(longitude),
        description,
        imageUrl,
        type: 'civic_mural',
        createdAt: new Date().toISOString(),
        active: true
      };

      await setDoc(doc(db, 'pois', id), muralData);

      setStatus({ type: 'success', message: 'MURAL_DEPLOYED_SUCCESSFULLY' });
      // Reset form
      setMuralName('');
      setArtist('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setDescription('');
      setImageUrl('');
    } catch (err) {
      console.error('Deployment error:', err);
      setStatus({ type: 'error', message: 'DEPLOYMENT_FAILED' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FFD700] font-mono p-6 selection:bg-[#FFD700] selection:text-[#0A0A0A]">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="mb-12 border-b border-[#FFD700]/30 pb-6 flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.4em] uppercase opacity-50 mb-1">Tactical_Civic_Admin</div>
            <h1 className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-3">
              <Palette className="text-[#FFD700]" /> Mural_Node_Deploy
            </h1>
          </div>
          <button 
            onClick={() => window.history.back()}
            className="p-2 border border-[#FFD700]/20 hover:bg-[#FFD700]/10 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        </header>

        <form onSubmit={handleDeployMural} className="space-y-8">
          {/* Basic Info */}
          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest opacity-60 flex items-center gap-2">
                  <Type size={12} /> Mural_Name
                </label>
                <input 
                  type="text"
                  value={muralName}
                  onChange={(e) => setMuralName(e.target.value)}
                  className="w-full bg-transparent border border-[#FFD700]/30 p-3 focus:border-[#FFD700] outline-none transition-colors uppercase placeholder:opacity-20"
                  placeholder="VIBRANT_CINCINNATI"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest opacity-60 flex items-center gap-2">
                  <User size={12} /> Artist_Identity
                </label>
                <input 
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="w-full bg-transparent border border-[#FFD700]/30 p-3 focus:border-[#FFD700] outline-none transition-colors uppercase placeholder:opacity-20"
                  placeholder="ARTIST_NAME"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest opacity-60 flex items-center gap-2">
                <MapPin size={12} /> Physical_Address
              </label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="flex-1 bg-transparent border border-[#FFD700]/30 p-3 focus:border-[#FFD700] outline-none transition-colors uppercase placeholder:opacity-20"
                  placeholder="1234 MAIN ST, CINCINNATI, OH"
                  required
                />
                <button 
                  type="button"
                  onClick={resolveCoords}
                  disabled={isResolving}
                  className="px-4 border border-[#FFD700] hover:bg-[#FFD700] hover:text-[#0A0A0A] transition-all text-[10px] font-bold uppercase disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                >
                  {isResolving ? <LocalPulseLoader variant="dots" /> : <><Search size={14} className="mr-2" /> Resolve_Coords</>}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest opacity-60">Latitude</label>
                <input 
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-transparent border border-[#FFD700]/30 p-3 focus:border-[#FFD700] outline-none transition-colors font-mono"
                  placeholder="39.1234"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest opacity-60">Longitude</label>
                <input 
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-transparent border border-[#FFD700]/30 p-3 focus:border-[#FFD700] outline-none transition-colors font-mono"
                  placeholder="-84.5678"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest opacity-60 flex items-center gap-2">
                <FileText size={12} /> Description
              </label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent border border-[#FFD700]/30 p-3 focus:border-[#FFD700] outline-none transition-colors uppercase placeholder:opacity-20 h-32 resize-none"
                placeholder="NARRATIVE_CONTEXT_FOR_THIS_ART_NODE"
              />
            </div>
          </section>

          {/* Image URL */}
          <section className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest opacity-60 flex items-center gap-2">
                <ImageIcon size={12} /> Visual_Asset_URL
              </label>
              <input 
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full bg-transparent border border-[#FFD700]/30 p-3 focus:border-[#FFD700] outline-none transition-colors font-mono placeholder:opacity-20"
                placeholder="HTTPS://EXAMPLE.COM/MURAL.JPG"
                required
              />
            </div>
            
            {imageUrl && (
              <div className="border border-[#FFD700]/20 p-4 bg-[#FFD700]/5">
                <div className="text-[8px] uppercase tracking-widest opacity-40 mb-2">Asset_Preview</div>
                <img 
                  src={imageUrl} 
                  alt="Preview" 
                  className="max-h-48 mx-auto border border-[#FFD700]/30 object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </section>

          {/* Status Messages */}
          <AnimatePresence>
            {status && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`p-4 border flex items-center gap-3 text-[10px] uppercase tracking-widest ${
                  status.type === 'success' 
                    ? 'bg-green-500/10 border-green-500 text-green-500' 
                    : 'bg-red-500/10 border-red-500 text-red-500'
                }`}
              >
                {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {status.message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#FFD700] text-[#0A0A0A] p-4 font-bold uppercase tracking-[0.2em] hover:bg-[#FFD700]/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50 min-h-[56px]"
          >
            {isSubmitting ? (
              <LocalPulseLoader variant="dots" />
            ) : (
              <>
                <Zap size={20} />
                Deploy_Mural_Node
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MuralNodeAdmin;
