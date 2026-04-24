import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, Timestamp, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { isSuperAdmin } from '../utils/auth';
import { Broadcast, BroadcastType, Node } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { format, addHours, differenceInMinutes } from 'date-fns';
import { geocodeAddress, findHubsInRadius, HubMatch } from '../utils/geoUtils';
import { 
  Search, X, Check, Loader2, MapPin, Radio, Layout, 
  Calendar, Clock, Zap, Link as LinkIcon, Image as ImageIcon,
  Activity, ArrowRight, Map as MapIcon, Share2, Globe, Truck,
  Navigation, Palette, Music, Building2, Store, Upload
} from 'lucide-react';

import { AddressSearchInput } from './AddressSearchInput';

interface BroadcastControlFormProps {
  formData: any;
  setFormData?: React.Dispatch<React.SetStateAction<any>>;
  setError: (error: string | null) => void;
  setSubmitting: (loading: boolean) => void;
  setSuccess: (success: boolean) => void;
  nodes?: Node[];
}

const StationDivider: React.FC<{ id: string; name: string }> = ({ id, name }) => (
  <div className="flex items-center gap-3 my-8">
    <span className="text-[8px] text-[#bbbbbb] font-mono tracking-[0.2em]">{id}</span>
    <div className="h-[0.5px] flex-1 bg-[#e0e0e0]" />
    <span className="text-[9px] text-[#1a1a1a] font-mono tracking-[0.14em] font-bold">{name}</span>
  </div>
);

export const BroadcastControlForm: React.FC<BroadcastControlFormProps & { isAdmin?: boolean }> = ({
  formData,
  setFormData,
  setError,
  setSubmitting,
  setSuccess,
  nodes = [],
  isAdmin: isAdminProp
}) => {
  const [isAdmin, setIsAdmin] = useState(isAdminProp || false);
  const [activeBroadcasts, setActiveBroadcasts] = useState<Broadcast[]>([]);
  const [resolving, setResolving] = useState(false);
  const [traceLocked, setTraceLocked] = useState(false);
  const [resolveError, setResolveError] = useState<string|null>(null);
  const [matchedHubs, setMatchedHubs] = useState<HubMatch[]>([]);
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);
  const [bridgedEvent, setBridgedEvent] = useState<Broadcast | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdminProp !== undefined) {
      setIsAdmin(isAdminProp);
    } else {
      const timer = setTimeout(async () => {
        const result = await isSuperAdmin();
        setIsAdmin(result);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isAdminProp]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLocalPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    setError(null);

    try {
      const storageRef = ref(storage, `broadcasts/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setFormData?.(prev => ({ ...prev, cover_url: downloadURL }));
    } catch (err) {
      console.error('Upload failed:', err);
      setError('IMAGE_UPLOAD_FAILURE');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const fetchActive = async () => {
      const q = query(collection(db, 'broadcasts'), where('status', '==', 'active'));
      const snap = await getDocs(q);
      setActiveBroadcasts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Broadcast));
    };
    fetchActive();
  }, []);

  const handleResolveLocation = async () => {
    if (!formData.custom_address) return;
    setResolving(true);
    setResolveError(null);
    setTraceLocked(false);
    
    try {
      // STEP 1 — Geocode the address
      const coords = await geocodeAddress(formData.custom_address);
      if (!coords) {
        setResolveError('Address not found — try a more specific address');
        return;
      }

      // STEP 2 — Find nearest hub within 3 miles
      const hubs = await findHubsInRadius(
        coords.lat,
        coords.lng,
        4828  // 3 miles in meters
      );

      // STEP 3 — Update form state
      setFormData?.(f => ({
        ...f,
        latitude:  coords.lat,
        longitude: coords.lng,
        node_id:   hubs[0]?.id || null,
        node_ids:  hubs.map(h => h.id),
        target_hub_name: hubs[0]?.name || 'No hub within 3 miles',
        scope: hubs.length > 0 ? 'multi_node' : 'all_nodes'
      }));

      setTraceLocked(true);
      setMatchedHubs(hubs);

    } catch (err) {
      setResolveError('Resolve failed — check address');
    } finally {
      setResolving(false);
    }
  };

  function parseDuration(duration: string): number {
    const map: Record<string, number> = {
      '1 HOUR':         1  * 60 * 60 * 1000,
      '2 HOURS':        2  * 60 * 60 * 1000,
      '4 HOURS':        4  * 60 * 60 * 1000,
      '8 HOURS':        8  * 60 * 60 * 1000,
      '24 HOURS':       24 * 60 * 60 * 1000,
      'UNTIL_CANCELLED': 365 * 24 * 60 * 60 * 1000,
    };
    return map[duration] ?? (2 * 60 * 60 * 1000); // default 2hr
  }

  const handleTransmit = async () => {
    if (!formData.title) {
      setError('SIGNAL_TITLE_REQUIRED');
      return;
    }

    setSubmitting(true);
    setLocalSubmitting(true);
    setError(null);

    try {
      const now = new Date();
      const durationMs = parseDuration(formData.signal_duration || '2 HOURS');
      const expiresAt = new Date(now.getTime() + durationMs);

      console.log('WRITING_NODE_ID:', formData.node_id);

      const broadcastDoc = {
        title:         formData.title,
        type:          formData.type || 'flash_deal',
        status:        'active',
        scope:         formData.scope || 'specific_node',
        is_sponsored:  formData.is_sponsored || false,
        sponsor_name:  formData.sponsor_name || null,
        
        // Link both for compatibility
        node_id:       formData.node_id || null,
        node_ids:      formData.node_ids || [],
        nodeId:        formData.node_id || null,
        latitude:      formData.latitude  || null,
        longitude:     formData.longitude || null,
        address:       formData.custom_address || null,
        venue:         formData.custom_address || null,

        starts_at:     Timestamp.fromDate(now),
        expires_at:    Timestamp.fromDate(expiresAt),
        // ISO string fallbacks for legacy components
        startsAt:      now.toISOString(),
        expiresAt:     expiresAt.toISOString(),
        
        expiry_warning_sent: false,

        cover_url:     formData.cover_url     || null,
        description:   formData.description   || null,
        artist:        formData.artist        || null,
        artist_url:    formData.artist_url    || null,
        booking_url:   formData.booking_url   || null,
        organizer_logo_url: formData.organizer_logo_url || null,
        partner_name:  formData.partner_name  || null,
        deal_description: formData.deal_description || null,
        year_created:  formData.year_created  || null,
        price:         formData.price ?? 0,
        spots_remaining: formData.spots_remaining || null,
        sponsor_logo_url: formData.sponsor_logo_url || null,

        partner_id:    formData.partner_id || 'urban-hikers-admin',
        partnerId:     formData.partner_id || 'urban-hikers-admin',
        partner_email: formData.partner_email || null,
        published_by:  auth.currentUser?.uid,
        is_admin_post: true,

        impressions:   0,
        taps:          0,
        payment_type:       'admin_bypass',
        stripe_session_id:  null,

        created_at:    Timestamp.now(),
        rotation_interval_seconds: formData.rotation_interval_seconds || 3,
        cross_connection_id: bridgedEvent?.id || null,
      };

      await addDoc(collection(db, 'broadcasts'), broadcastDoc);

      setShowSuccessFlash(true);
      setTimeout(() => setShowSuccessFlash(false), 400);
      
      setSuccess(true);
      setLocalSuccess(true);
      setLocalPreview(null);
      setTimeout(() => {
        setSuccess(false);
        setLocalSuccess(false);
      }, 2000);
      setSubmitting(false);
      setLocalSubmitting(false);
    } catch (err) {
      console.error('Transmission failed', err);
      setError('SIGNAL_PHASE_FAILURE');
      setSubmitting(false);
      setLocalSubmitting(false);
    }
  };

  const getRotationFrequency = () => formData.rotation_interval_seconds || 3;

  return (
    <div className="relative bg-[#f5f5f3] min-h-screen text-[#1a1a1a] font-mono flex flex-col p-0">
      <AnimatePresence>
        {showSuccessFlash && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[9999] pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Admin Status Bar */}
      {isAdmin && (
        <div className="flex justify-between items-center px-6 py-2 bg-[#0a2e1a] border-b border-[#1D9E75] z-20">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] animate-pulse" />
            <span className="text-[8px] text-[#1D9E75] tracking-[0.16em] font-bold">SUPER_ADMIN_MODE</span>
          </div>
          <span className="text-[8px] text-[#1D9E75] tracking-[0.12em] font-bold">PAYMENT_BYPASS · ACTIVE</span>
        </div>
      )}

      {/* Main Wrapper */}
      <div className={`relative px-6 py-8 flex-1 transition-all duration-500`}>
        
        {/* Card Container */}
        <div className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[12px] p-8 shadow-sm overflow-hidden">
          
          {/* Header Section */}
          <div className="flex justify-between items-start mb-10">
            <div>
              <h1 className="text-[14px] font-bold tracking-[0.08em] text-[#1a1a1a]">BROADCAST_CONTROL</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[#999] tracking-[0.15em] uppercase">ACTIVE_FEEDS:</span>
              <span className="text-[12px] font-bold text-[#1a1a1a]">{activeBroadcasts.length}</span>
            </div>
          </div>

          {/* STATION_01 — THE SIGNAL */}
          <StationDivider id="STATION_01" name="THE SIGNAL" />
          
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">BROADCAST_TITLE</label>
              <input 
                type="text"
                value={formData.title || ''}
                onChange={e => setFormData?.(f => ({ ...f, title: e.target.value }))}
                placeholder="ENTER_SIGNAL_IDENTIFIER"
                className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none transition-all placeholder:text-[#cccccc] placeholder:font-normal"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">BROADCAST_TYPE</label>
              <select
                value={formData.type || ''}
                onChange={e => setFormData?.(f => ({ ...f, type: e.target.value }))}
                className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none transition-all appearance-none cursor-pointer"
              >
                {Object.values(BroadcastType).map(type => (
                  <option key={type} value={type} className="bg-white">{type.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">SPONSORED_SIGNAL</label>
                <button 
                  type="button"
                  onClick={() => setFormData?.(f => ({ ...f, is_sponsored: !f.is_sponsored }))}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${formData.is_sponsored ? 'bg-[#FFE01A]' : 'bg-[#e0e0e0]'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${formData.is_sponsored ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {formData.is_sponsored && (
                <div className="flex flex-col gap-2 border-l-2 border-[#FFE01A] pl-4 animate-in fade-in duration-300">
                  <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">SPONSOR_NAME</label>
                  <input 
                    type="text"
                    value={formData.sponsor_name || ''}
                    onChange={e => setFormData?.(f => ({ ...f, sponsor_name: e.target.value }))}
                    placeholder="ENTITY_CREDENTIALS"
                    className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none transition-all placeholder:text-[#cccccc] placeholder:font-normal"
                  />
                </div>
              )}
            </div>
          </div>

          {/* MEDIA SECTION */}
          <div className="mt-8 pt-8 border-t border-[#e0e0e0]">
            <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase mb-4 block">COVER_IMAGE</label>
            
            <div className="flex flex-col gap-6">
              {/* Preview Box */}
              <div className="relative aspect-video w-full bg-[#f8f8f8] border-[0.5px] border-[#e0e0e0] rounded-[10px] overflow-hidden group">
                {(formData.cover_url || localPreview) ? (
                  <>
                    <img 
                      src={localPreview || formData.cover_url} 
                      alt="Preview" 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-[#0a0a0a]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => {
                          setFormData?.(f => ({ ...f, cover_url: '' }));
                          setLocalPreview(null);
                        }}
                        className="p-2 bg-white rounded-full text-[#0a0a0a] shadow-lg hover:bg-[#FFE01A] transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-[#cccccc] gap-2">
                    <ImageIcon size={32} strokeWidth={1} />
                    <span className="text-[10px] font-bold tracking-widest uppercase">NO_SIGNAL_MEDIA_DETECTED</span>
                  </div>
                )}
                
                {uploading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={24} className="animate-spin text-[#0a0a0a]" />
                      <span className="text-[9px] font-bold tracking-widest uppercase text-[#0a0a0a]">UPLOADING_ASSETS...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <input 
                  type="text"
                  value={formData.cover_url || ''}
                  onChange={e => setFormData?.(f => ({ ...f, cover_url: e.target.value }))}
                  placeholder="EXTERNAL_SIGNAL_URL"
                  className="flex-1 bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold focus:border-[1px] focus:border-[#FFE01A] outline-none transition-all placeholder:text-[#cccccc] placeholder:font-normal"
                />
                
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-6 rounded-[10px] bg-[#0a0a0a] text-white text-[10px] font-bold tracking-[0.16em] uppercase hover:bg-[#FFE01A] hover:text-[#0a0a0a] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  UPLOAD
                </button>
              </div>
              <p className="text-[8px] text-[#bbbbbb] tracking-widest uppercase">PASTE_REMOTE_URL_OR_UPLOAD_LOCAL_SOURCE</p>
            </div>
          </div>

          {/* DYNAMIC SIGNAL DETAILS SECTION */}
          <div className="mt-8 pt-8 border-t border-[#e0e0e0]">
            <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase mb-4 block underline decoration-[#FFE01A] decoration-2">SIGNAL_DETAILS</label>
            <p className="text-[10px] text-[#bbbbbb] mb-6 tracking-wide italic">Additional fields for this signal type</p>

            <div className="flex flex-col gap-6">
              {formData.type === BroadcastType.WALKING_EVENT && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">ORGANIZER_NAME</label>
                    <input 
                      type="text" 
                      value={formData.partner_name || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, partner_name: e.target.value }))}
                      placeholder="e.g. Urban Hikers, Cincinnati Walking Club"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <p className="text-[8px] text-[#bbbbbb]">Shown above the walk title on the card</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">ORGANIZER_LOGO</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={formData.organizer_logo_url || ''} 
                        onChange={e => setFormData?.(f => ({ ...f, organizer_logo_url: e.target.value }))}
                        placeholder="https://... or upload logo"
                        className="flex-1 bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                      />
                      <button 
                        type="button" 
                        onClick={() => {
                          const fileInput = document.createElement('input');
                          fileInput.type = 'file';
                          fileInput.accept = 'image/*';
                          fileInput.onchange = async (e: any) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
                            const snapshot = await uploadBytes(storageRef, file);
                            const url = await getDownloadURL(snapshot.ref);
                            setFormData?.(f => ({ ...f, organizer_logo_url: url }));
                          };
                          fileInput.click();
                        }}
                        className="px-4 bg-[#0a0a0a] text-white text-[10px] rounded-[10px] hover:bg-[#FFE01A] hover:text-[#0a0a0a] transition-all"
                      >
                        UPLOAD
                      </button>
                    </div>
                    <p className="text-[8px] text-[#bbbbbb]">White pill top-left of card. PNG with transparent background works best.</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">BOOKING_URL</label>
                    <input 
                      type="text" 
                      value={formData.booking_url || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, booking_url: e.target.value }))}
                      placeholder="https://eventbrite.com/... or lu.ma/..."
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <p className="text-[8px] text-[#bbbbbb]">Book Now button links here. Leave empty for inline booking sheet.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] text-[#999] tracking-widest uppercase">PRICE</label>
                      <input 
                        type="number" 
                        min="0"
                        value={formData.price ?? ''} 
                        onChange={e => setFormData?.(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                        placeholder="0"
                        className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                      />
                      <p className="text-[8px] text-[#bbbbbb]">0 = Free. Shown in booking sheet.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] text-[#999] tracking-widest uppercase">SPOTS_AVAILABLE</label>
                      <input 
                        type="number" 
                        value={formData.spots_remaining ?? ''} 
                        onChange={e => setFormData?.(f => ({ ...f, spots_remaining: parseInt(e.target.value) || 0 }))}
                        placeholder="20"
                        className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                      />
                      <p className="text-[8px] text-[#bbbbbb]">Total spots. Decrements on each booking.</p>
                    </div>
                  </div>
                </div>
              )}

              {(formData.type === BroadcastType.MURAL || formData.type === BroadcastType.STREET_ART) && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">ARTIST_NAME</label>
                    <input 
                      type="text" 
                      value={formData.artist || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, artist: e.target.value }))}
                      placeholder="e.g. Jenny Ustick"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <p className="text-[8px] text-[#bbbbbb]">Shown as byline below the title on the card</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">ARTIST_WEBSITE</label>
                    <input 
                      type="text" 
                      value={formData.artist_url || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, artist_url: e.target.value }))}
                      placeholder="https://..."
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <p className="text-[8px] text-[#bbbbbb]">Linked from artist name on detail view</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">YEAR_CREATED</label>
                    <input 
                      type="number" 
                      value={formData.year_created ?? ''} 
                      onChange={e => setFormData?.(f => ({ ...f, year_created: parseInt(e.target.value) || 0 }))}
                      placeholder="2023"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none w-1/3"
                    />
                  </div>
                </div>
              )}

              {formData.type === BroadcastType.FLASH_DEAL && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">DEAL_DESCRIPTION</label>
                    <input 
                      type="text" 
                      value={formData.deal_description || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, deal_description: e.target.value }))}
                      placeholder="e.g. 50% off tacos with any drink"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <p className="text-[8px] text-[#bbbbbb]">Short offer text — shown in booking sheet</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">REDEMPTION_URL</label>
                    <input 
                      type="text" 
                      value={formData.booking_url || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, booking_url: e.target.value }))}
                      placeholder="https://... or leave empty to show in-person"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <p className="text-[8px] text-[#bbbbbb]">Where to claim the deal. Empty = show at venue.</p>
                  </div>
                </div>
              )}

              {formData.type === BroadcastType.LIVE_EVENT && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">PERFORMER / ARTIST</label>
                    <input 
                      type="text" 
                      value={formData.artist || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, artist: e.target.value }))}
                      placeholder="e.g. Marcus Miller Quartet"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <p className="text-[8px] text-[#bbbbbb]">Shown on the card as performer name</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">TICKET_URL</label>
                    <input 
                      type="text" 
                      value={formData.booking_url || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, booking_url: e.target.value }))}
                      placeholder="https://..."
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <p className="text-[8px] text-[#bbbbbb]">View button links here</p>
                  </div>
                </div>
              )}

              {formData.type === BroadcastType.CIVIC_EVENT && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">ORGANIZATION</label>
                    <input 
                      type="text" 
                      value={formData.partner_name || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, partner_name: e.target.value }))}
                      placeholder="e.g. Cincinnati Public Library"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">REGISTRATION_URL</label>
                    <input 
                      type="text" 
                      value={formData.booking_url || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, booking_url: e.target.value }))}
                      placeholder="https://..."
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <p className="text-[8px] text-[#bbbbbb]">Registration link. Leave empty if walk-in.</p>
                  </div>
                </div>
              )}

              {formData.type === BroadcastType.FOOD_TRUCK && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">TRUCK_NAME</label>
                    <input 
                      type="text" 
                      value={formData.partner_name || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, partner_name: e.target.value }))}
                      placeholder="e.g. Sababa on Wheels"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">MENU_URL</label>
                    <input 
                      type="text" 
                      value={formData.booking_url || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, booking_url: e.target.value }))}
                      placeholder="https://... menu link"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <p className="text-[8px] text-[#bbbbbb]">View button links here</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STATION_02 — THE TERMINAL */}
          <StationDivider id="STATION_02" name="THE TERMINAL" />

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">CUSTOM_ADDRESS</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <AddressSearchInput 
                    value={formData.custom_address || ''}
                    onSelect={(addr) => {
                      setFormData?.(f => ({ ...f, custom_address: addr }));
                    }}
                    placeholder="Enter event address e.g. 1215 Elm St, Cincinnati, OH"
                    className="!rounded-[10px] !border-[#e0e0e0] !p-0"
                  />
                </div>
                <button 
                  type="button"
                  onClick={handleResolveLocation}
                  disabled={resolving}
                  className={`px-6 rounded-[10px] ${resolving ? 'bg-[#0a0a0a] text-[#FFE01A] opacity-80 animate-pulse' : 'bg-[#0a0a0a] text-white'} text-[10px] font-bold tracking-[0.16em] uppercase flex items-center justify-center min-w-[100px] hover:bg-[#FFE01A] hover:text-[#0a0a0a] transition-all h-[46px]`}
                >
                  {resolving ? 'RESOLVING...' : 'RESOLVE'}
                </button>
              </div>
              
              <AnimatePresence>
                {traceLocked && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {/* Coordinates pill */}
                    <div style={{
                      background: '#FFE01A', color: '#0a0a0a',
                      fontSize: 9, fontWeight: 700,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '5px 14px', borderRadius: 6,
                      fontFamily: 'monospace', display: 'inline-block',
                      width: 'fit-content'
                    }}>
                      TRACE_LOCKED · {formData.latitude?.toFixed(4)}, {formData.longitude?.toFixed(4)}
                    </div>

                    {/* Hub list */}
                    {matchedHubs.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{
                          fontSize: 8, letterSpacing: '0.16em',
                          textTransform: 'uppercase', color: '#999',
                          marginBottom: 2
                        }}>
                          {matchedHubs.length} hub{matchedHubs.length > 1 ? 's' : ''} within 3 miles — broadcasting to all
                        </div>
                        {matchedHubs.map((hub, i) => (
                          <div key={hub.id} style={{
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#0a2e1a',
                            border: '0.5px solid #1D9E75',
                            borderRadius: 6,
                            padding: '6px 12px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: i === 0 ? '#FFE01A' : '#1D9E75'
                              }} />
                              <span style={{
                                fontSize: 9, fontWeight: 700,
                                letterSpacing: '0.1em', textTransform: 'uppercase',
                                color: '#7dd3a8', fontFamily: 'monospace'
                              }}>
                                {i === 0 ? '★ ' : ''}{hub.name}
                              </span>
                            </div>
                            <span style={{
                              fontSize: 8, color: '#0f6e56',
                              letterSpacing: '0.06em'
                            }}>
                              {(hub.distance / 1609.34).toFixed(1)} mi
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        background: '#1f1a00', border: '0.5px solid #c8a800',
                        borderRadius: 6, padding: '6px 12px',
                        fontSize: 9, color: '#c8a800',
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        fontFamily: 'monospace'
                      }}>
                        NO_HUB_IN_RANGE · signal will broadcast citywide
                      </div>
                    )}
                  </div>
                )}
                {resolveError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#fee2e2] text-[#991b1b] text-[9px] font-bold px-[14px] py-[5px] mt-2 inline-block w-fit rounded-[6px] tracking-[0.1em] uppercase"
                  >
                    RESOLVE_FAILED — {resolveError}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* STATION_03 — THE SCHEDULE */}
          <StationDivider id="STATION_03" name="THE SCHEDULE" />

          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">EVENT_DATE</label>
                <input 
                  type="date"
                  className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">START</label>
                  <input type="time" className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">END</label>
                  <input type="time" className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">SIGNAL_START_DELAY</label>
                <select className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none">
                  <option>IMMEDIATE</option>
                  <option>15_MIN</option>
                  <option>30_MIN</option>
                  <option>60_MIN</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">SIGNAL_DURATION</label>
                <select 
                  value={formData.signal_duration || '2 HOURS'}
                  onChange={e => setFormData?.(f => ({ ...f, signal_duration: e.target.value }))}
                  className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none"
                >
                  <option value="1 HOUR">1_HOUR</option>
                  <option value="2 HOURS">2_HOURS</option>
                  <option value="4 HOURS">4_HOURS</option>
                  <option value="8 HOURS">8_HOURS</option>
                  <option value="24 HOURS">24_HOURS</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">ROTATION_FREQUENCY</label>
              <div className="grid grid-cols-3 gap-2">
                {[3, 6, 9].map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setFormData?.(f => ({ ...f, rotation_interval_seconds: sec }))}
                    className={`p-3 text-[10px] font-bold border-[0.5px] rounded-[6px] transition-all ${getRotationFrequency() === sec ? 'bg-[#FFE01A] text-[#0a0a0a] border-[#FFE01A]' : 'bg-white text-[#999999] border-[#e0e0e0]'}`}
                  >
                    {sec}S
                  </button>
                ))}
              </div>
              <p className="text-[8px] text-[#bbbbbb] tracking-widest uppercase mt-1">HOW OFTEN THIS SIGNAL APPEARS IN THE CITY LOOP</p>
            </div>

            <div className="text-[9px] text-[#1D9E75] tracking-[0.08em] mt-2 font-mono">
              SIGNAL GOES LIVE: {format(new Date(), 'eee MMM dd')} · 10:00 AM → 12:30 PM (150M)
            </div>
          </div>

          {/* CROSS_CONNECTION */}
          <StationDivider id="CROSS_CONNECTION" name="SIGNAL BRIDGE" />
          <div className="flex flex-col gap-4">
            <p className="text-[9px] text-[#999] tracking-[0.15em] uppercase">LINK THIS SIGNAL TO ANOTHER ACTIVE EVENT</p>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search size={14} className="text-[#cccccc]" />
              </div>
              <select 
                onChange={e => {
                  const found = activeBroadcasts.find(b => b.id === e.target.value);
                  setBridgedEvent(found || null);
                }}
                className="w-full bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px_14px_44px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none appearance-none cursor-pointer"
              >
                <option value="">SEARCH_ACTIVE_SIGNALS</option>
                {activeBroadcasts.map(b => (
                  <option key={b.id} value={b.id}>{b.title.toUpperCase()} — {b.type.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <AnimatePresence>
              {bridgedEvent && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-[#FFE01A] text-[#0a0a0a] p-3 rounded-[6px] flex justify-between items-center"
                >
                  <div className="flex items-center gap-3 font-bold text-[10px]">
                    <LinkIcon size={12} />
                    <span>BRIDGE_LOCKED: {bridgedEvent.title.toUpperCase()}</span>
                  </div>
                  <button type="button" onClick={() => setBridgedEvent(null)}>
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* TRANSMIT_SIGNAL */}
          <div className="mt-16">
            <button
              type="button"
              onClick={handleTransmit}
              className={`w-full p-5 text-[13px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-4 transition-all duration-300 rounded-[10px] ${
                localSuccess
                ? 'bg-[#1D9E75] text-[#0a0a0a]'
                : 'bg-[#0a0a0a] text-[#FFE01A] hover:bg-[#FFE01A] hover:text-[#0a0a0a]'
              }`}
            >
              {localSubmitting ? (
                <span className="flex items-center gap-3 animate-pulse">
                  TRANSMITTING...
                </span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10c0-3.31 2.69-6 6-6M7 10c0-1.65 1.35-3 3-3"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    <circle cx="10" cy="10" r="1.8" fill="currentColor"/>
                  </svg>
                  <span>{localSuccess ? 'SIGNAL_TRANSMITTED ✓' : 'TRANSMIT_SIGNAL'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
