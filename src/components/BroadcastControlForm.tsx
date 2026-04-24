import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, Timestamp, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { isSuperAdmin } from '../utils/auth';
import { Broadcast, BroadcastType, Node } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { format, addHours, differenceInMinutes } from 'date-fns';
import { 
  Search, X, Check, Loader2, MapPin, Radio, Layout, 
  Calendar, Clock, Zap, Link as LinkIcon, Image as ImageIcon,
  Activity, ArrowRight, Map as MapIcon, Share2, Globe, Truck,
  Navigation, Palette, Music, Building2, Store
} from 'lucide-react';

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
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [resolveError, setResolveError] = useState(false);
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);
  const [bridgedEvent, setBridgedEvent] = useState<Broadcast | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);

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

  useEffect(() => {
    const fetchActive = async () => {
      const q = query(collection(db, 'broadcasts'), where('status', '==', 'active'));
      const snap = await getDocs(q);
      setActiveBroadcasts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Broadcast));
    };
    fetchActive();
  }, []);

  const handleResolveLocation = () => {
    if (!formData.address) return;
    setResolving(true);
    setResolveError(false);
    
    // Simulation logic
    setTimeout(() => {
      setResolving(false);
      // For demo purposes, we generate some random-ish coordinates near Cincinnati if not specific
      const lat = 39.1031 + (Math.random() - 0.5) * 0.01;
      const lng = -84.5120 + (Math.random() - 0.5) * 0.01;
      setResolvedCoords({ lat, lng });
      setFormData?.(f => ({ ...f, latitude: lat, longitude: lng }));
    }, 1200);
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

      const broadcastDoc = {
        title:         formData.title,
        type:          formData.type || 'flash_deal',
        status:        'active',
        scope:         formData.scope || 'specific_node',
        is_sponsored:  formData.is_sponsored || false,
        sponsor_name:  formData.sponsor_name || null,
        
        node_id:       formData.node_id || null,
        latitude:      formData.latitude  || null,
        longitude:     formData.longitude || null,

        starts_at:     Timestamp.fromDate(now),
        expires_at:    Timestamp.fromDate(expiresAt),
        expiry_warning_sent: false,

        cover_url:     formData.cover_url || null,
        description:   formData.description || null,
        artist:        formData.artist || null,
        booking_url:   formData.booking_url || null,
        sponsor_logo_url: formData.sponsor_logo_url || null,

        partner_id:    formData.partner_id || 'urban-hikers-admin',
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
            <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase mb-2 block">COVER_IMAGE</label>
            <div className="flex gap-3">
              <input 
                type="text"
                value={formData.cover_url || ''}
                onChange={e => setFormData?.(f => ({ ...f, cover_url: e.target.value }))}
                placeholder="EXTERNAL_SIGNAL_URL"
                className="flex-1 bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold focus:border-[1px] focus:border-[#FFE01A] outline-none transition-all placeholder:text-[#cccccc] placeholder:font-normal"
              />
              <button className="px-6 rounded-[10px] bg-[#0a0a0a] text-white text-[10px] font-bold tracking-[0.16em] uppercase hover:bg-[#FFE01A] hover:text-[#0a0a0a] transition-all">
                UPLOAD
              </button>
            </div>
          </div>

          {/* STATION_02 — THE TERMINAL */}
          <StationDivider id="STATION_02" name="THE TERMINAL" />

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">SIGNAL_LOCATION_SOURCE</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px]">
                <button 
                  type="button"
                  onClick={() => setFormData?.(f => ({ ...f, locationSource: 'node' }))}
                  className={`p-3 rounded-[8px] text-[9px] font-bold tracking-widest transition-all ${formData.locationSource === 'node' ? 'bg-[#FFE01A] text-[#0a0a0a]' : 'bg-white text-[#999999]'}`}
                >
                  SPECIFIC_HUB_LOCATION
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData?.(f => ({ ...f, locationSource: 'partner' }))}
                  className={`p-3 rounded-[8px] text-[9px] font-bold tracking-widest transition-all ${formData.locationSource === 'partner' ? 'bg-[#FFE01A] text-[#0a0a0a]' : 'bg-white text-[#999999]'}`}
                >
                  PARTNER_DEFAULT_LOCATION
                </button>
              </div>
            </div>

            <div className={`flex flex-col gap-2 transition-all duration-300 ${formData.locationSource === 'partner' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">TARGET_HUB</label>
              <select
                value={formData.node_id || ''}
                onChange={e => setFormData?.(f => ({ ...f, node_id: e.target.value }))}
                className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none"
              >
                <option value="">SELECT_TRANSIT_HUB</option>
                {nodes.map(node => (
                  <option key={node.id} value={node.id}>{node.name.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className={`flex flex-col gap-2 transition-all duration-300 ${formData.locationSource === 'node' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">CUSTOM_ADDRESS</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={formData.address || ''}
                  onChange={e => setFormData?.(f => ({ ...f, address: e.target.value }))}
                  placeholder="PROXIMITY_STRING_INPUT"
                  className="flex-1 bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none placeholder:text-[#cccccc] placeholder:font-normal"
                />
                <button 
                  type="button"
                  onClick={handleResolveLocation}
                  disabled={resolving}
                  className="px-6 rounded-[10px] bg-[#0a0a0a] text-white text-[10px] font-bold tracking-[0.16em] uppercase flex items-center justify-center min-w-[100px] hover:bg-[#FFE01A] hover:text-[#0a0a0a] transition-all"
                >
                  {resolving ? <Loader2 size={12} className="animate-spin" /> : 'RESOLVE'}
                </button>
              </div>
              
              <AnimatePresence>
                {resolvedCoords ? (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#FFE01A] text-[#0a0a0a] text-[9px] font-bold px-[14px] py-[5px] mt-2 inline-block w-fit rounded-[6px] tracking-[0.1em] uppercase"
                  >
                    TRACE_LOCKED · {resolvedCoords.lat.toFixed(4)}, {resolvedCoords.lng.toFixed(4)}
                  </motion.div>
                ) : formData.address && resolveError ? (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#fee2e2] text-[#991b1b] text-[9px] font-bold px-[14px] py-[5px] mt-2 inline-block w-fit rounded-[6px] tracking-[0.1em] uppercase"
                  >
                    RESOLVE_FAILED — check address
                  </motion.div>
                ) : null}
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
