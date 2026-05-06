import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, Timestamp, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { isSuperAdmin } from '../utils/auth';
import { Broadcast, BroadcastType, Node, UserProfile } from '../types';
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
  isAdmin?: boolean;
  userProfile?: UserProfile | null;
}

const StationDivider: React.FC<{ id: string; name: string }> = ({ id, name }) => (
  <div className="flex items-center gap-3 my-8">
    <span className="text-[8px] text-[#bbbbbb] font-mono tracking-[0.2em]">{id}</span>
    <div className="h-[0.5px] flex-1 bg-[#e0e0e0]" />
    <span className="text-[9px] text-[#1a1a1a] font-mono tracking-[0.14em] font-bold">{name}</span>
  </div>
);

const initialFormState = {
  title:                '',
  type:                 BroadcastType.LIVE_EVENT,
  description:          '',
  cover_url:            '',
  custom_address:       '',
  node_id:              null as string | null,
  node_ids:             [] as string[],
  latitude:             null as number | null,
  longitude:            null as number | null,
  event_date:           '',
  start_time:           '',
  end_time:             '',
  is_sponsored:         false,
  sponsor_name:         '',
  booking_url:          '',
  organizer_logo_url:   '',
  partner_name:         '',
  artist:               '',
  artist_url:           '',
  deal_description:     '',
  year_created:         null as number | null,
  price:                0,
  spots_remaining:      null as number | null,
  rotation_interval_seconds: 3,
  cross_connection_id:  null as string | null,
  scope:                'specific_node' as 'specific_node' | 'all_nodes' | 'multi_node',
  departure_time:       '',
  meeting_point:        '',
  guide_name:           '',
  discount_value:       '',
  is_recurring:         false,
  recurring_days:       [] as string[],
  recurring_times:      [] as string[],
  duration_minutes:     60,
  recurring_frequency:  'daily' as any,
  recurring_week_of_month: 1 as any,
};

interface ValidationResult {
  valid:  boolean
  errors: Record<string, string>
}

function validateBroadcast(
  formData: any,
  traceLocked: boolean
): ValidationResult {
  const errors: Record<string, string> = {}

  // ── STATION 01 — THE SIGNAL ──────────────────
  if (!formData.title?.trim()) {
    errors.title = 'Signal title is required'
  }
  if (!formData.type) {
    errors.type = 'Broadcast type is required'
  }

  // ── STATION 02 — THE TERMINAL ────────────────
  if (!traceLocked) {
    errors.address =
      'Address must be resolved — click RESOLVE first'
  }
  if (!formData.latitude || !formData.longitude) {
    if (!errors.address) {
      errors.address = 'Location coordinates missing — resolve address again'
    }
  }

  // ── STATION 03 — THE SCHEDULE ────────────────
  if (!formData.is_recurring && !formData.event_date) {
    errors.event_date = 'Event date is required'
  }
  if (!formData.is_recurring && !formData.start_time) {
    errors.start_time = 'Start time is required'
  }
  if (formData.is_recurring && (!formData.recurring_days?.length || !formData.recurring_times?.length)) {
    errors.recurrence = 'At least one day and one time required for recurrence';
  }

  // End time must be after start time
  if (formData.event_date && formData.start_time && formData.end_time) {
    const start = new Date(`${formData.event_date}T${formData.start_time}`)
    const end   = new Date(`${formData.event_date}T${formData.end_time}`)
    if (end <= start) {
      errors.end_time = 'End time must be after start time'
    }
  }

  // Start time must not be in the past (allow 5 min buffer)
  if (formData.event_date && formData.start_time) {
    const start = new Date(
      `${formData.event_date}T${formData.start_time}`
    )
    if (start.getTime() < Date.now() - 5 * 60 * 1000) {
      errors.start_time =
        'Start time is in the past — update the schedule'
    }
  }

  // ── TYPE-SPECIFIC CHECKS ─────────────────────
  if (formData.type === BroadcastType.WALKING_EVENT) {
    if (!formData.booking_url?.trim()) {
      errors.booking_url =
        'Booking URL required for walks — add external link'
    }
  }

  if (
    formData.type === BroadcastType.MURAL ||
    formData.type === BroadcastType.STREET_ART
  ) {
    if (!formData.artist?.trim()) {
      errors.artist = 'Artist name recommended for murals'
    }
  }

  // ── COVER IMAGE ──────────────────────────────
  if (!formData.cover_url?.trim()) {
    errors.cover_url =
      'Cover image required — upload or paste URL'
  }

  return {
    valid:  Object.keys(errors).length === 0,
    errors,
  }
}

export const BroadcastControlForm: React.FC<BroadcastControlFormProps> = ({
  formData,
  setFormData,
  setError,
  setSubmitting,
  setSuccess,
  nodes = [],
  isAdmin: isAdminProp,
  userProfile
}) => {
  const [submitting, setInternalSubmitting] = useState(false); // Used to lock double submits
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/sync/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setSyncResult(data);
    } catch (err) {
      setSyncResult({ success: false, error: String(err) });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (formData.latitude && formData.longitude && !traceLocked) {
      setTraceLocked(true);
    }
  }, [formData.latitude, formData.longitude]);

  useEffect(() => {
    const result = validateBroadcast(formData, traceLocked)
    setErrors(result.errors)
  }, [formData, traceLocked]);

  const touch = (field: string) =>
    setTouched(t => ({ ...t, [field]: true }));

  const showError = (field: string) =>
    touched[field] && !!errors[field];

  const ErrorLine: React.FC<{ field: string }> = ({ field }) => {
    if (!showError(field)) return null;
    return (
      <div style={{
        fontSize: 8,
        color: '#E24B4A',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginTop: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'monospace',
      }}>
        <svg width="10" height="10" viewBox="0 0 20 20" fill="#E24B4A">
          <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 4v4m0 4v.01" stroke="#E24B4A"
            strokeWidth="2" strokeLinecap="round" fill="none"/>
        </svg>
        {errors[field]}
      </div>
    );
  };
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
    // Mark everything touched — show all errors
    const allFields = [
      'title', 'type', 'address', 'event_date',
      'start_time', 'end_time', 'cover_url',
      'booking_url', 'artist'
    ];
    setTouched(
      Object.fromEntries(allFields.map(f => [f, true]))
    );

    const validationResult = validateBroadcast(formData, traceLocked);
    if (!validationResult.valid) return;   // hard stop

    if (submitting) return; // Prevent double submit

    if (!formData.title) {
      setError('SIGNAL_TITLE_REQUIRED');
      return;
    }

    // Build Date objects from form inputs
    function buildDate(date: string, time: string): Date | null {
      if (!date || !time) return null;
      const d = new Date(`${date}T${time}`);
      return isNaN(d.getTime()) ? null : d;
    }

    const startsDate  = buildDate(formData.event_date, formData.start_time);
    const expiresDate = buildDate(formData.event_date, formData.end_time);

    // Validation
    if (expiresDate && startsDate && expiresDate <= startsDate) {
      setError('End time must be after start time');
      return;
    }
    if (startsDate && startsDate < new Date()) {
      setError('Start time cannot be in the past');
      return;
    }

    setInternalSubmitting(true);
    setSubmitting(true);
    setLocalSubmitting(true);
    setError(null);

    try {
      const now = new Date();
      // Default fallbacks if times were not specified in form (though they should be)
      const defaultStart = startsDate || now;
      const defaultExpires = expiresDate || new Date(defaultStart.getTime() + 4 * 60 * 60 * 1000);

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

        is_recurring:   formData.is_recurring || false,
        recurring_days:  formData.recurring_days || [],
        recurring_times: formData.recurring_times || [],
        duration_minutes: formData.duration_minutes || 60,
        recurring_frequency: formData.recurring_frequency || 'daily',
        recurring_week_of_month: formData.recurring_week_of_month || 1,

        starts_at:     formData.is_recurring ? Timestamp.fromDate(new Date()) : Timestamp.fromDate(defaultStart),
        expires_at:    formData.is_recurring ? Timestamp.fromDate(new Date("2099-12-31")) : Timestamp.fromDate(defaultExpires),
        // ISO string fallbacks for legacy components
        startsAt:      formData.is_recurring ? new Date().toISOString() : defaultStart.toISOString(),
        expiresAt:     formData.is_recurring ? new Date("2099-12-31").toISOString() : defaultExpires.toISOString(),
        
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
        price:         formData.type === BroadcastType.CIVIC_EVENT ? 0 : (formData.price ?? 0),
        spots_remaining: formData.spots_remaining || null,
        sponsor_logo_url: formData.sponsor_logo_url || null,
        departure_time: formData.departure_time || null,
        meeting_point:  formData.meeting_point  || null,
        guide_name:     formData.guide_name     || null,
        discount_value: formData.discount_value || null,

        partner_id:    formData.partner_id || userProfile?.partner_id || userProfile?.partnerId || 'urban-hikers-admin',
        partnerId:     formData.partner_id || userProfile?.partner_id || userProfile?.partnerId || 'urban-hikers-admin',
        partner_email: formData.partner_email || userProfile?.email || null,
        published_by:  auth.currentUser?.uid,
        is_admin_post: isAdmin || (userProfile?.role === 'admin' || userProfile?.role === 'super_admin'),

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
      
      // Reset form AFTER successful write
      setFormData?.(initialFormState);
      setTraceLocked(false);
      setMatchedHubs([]);
      setSuccess(true);
      setLocalSuccess(true);
      setLocalPreview(null);

      setTimeout(() => {
        setSuccess(false);
        setLocalSuccess(false);
      }, 3000);

    } catch (err) {
      console.error('Transmission failed', err);
      setError('SIGNAL_PHASE_FAILURE');
    } finally {
      setInternalSubmitting(false);
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
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] animate-pulse" />
              <span className="text-[8px] text-[#1D9E75] tracking-[0.16em] font-bold">SUPER_ADMIN_MODE · PAYMENT_BYPASS</span>
            </div>
            {syncResult && (
              <div style={{
                fontSize: 8,
                color: syncResult.success ? '#1D9E75' : '#E24B4A',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontFamily: 'monospace',
                marginTop: 2,
              }}>
                {syncResult.success
                  ? `↑ ${syncResult.total} events synced —
                     CHPL: ${syncResult.chpl}
                     Visit Cincy: ${syncResult.visitCincy}`
                  : `SYNC_FAILED: ${syncResult.error}`
                }
              </div>
            )}
          </div>
          
          <button
            onClick={handleManualSync}
            disabled={syncing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: 'transparent',
              border: '0.5px solid #1D9E75',
              borderRadius: 6,
              color: '#1D9E75',
              fontFamily: 'monospace',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: syncing ? 'not-allowed' : 'pointer',
              opacity: syncing ? 0.6 : 1,
            }}
          >
            {syncing ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite' }}>↻</span>
                SYNCING...
              </>
            ) : (
              <>↻ SYNC_FEEDS</>
            )}
          </button>
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
                onBlur={() => touch('title')}
                placeholder="ENTER_SIGNAL_IDENTIFIER"
                style={{
                  border: showError('title') ? '1px solid #E24B4A' : '0.5px solid #e0e0e0',
                }}
                className="bg-white rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none transition-all placeholder:text-[#cccccc] placeholder:font-normal"
              />
              <ErrorLine field="title" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">BROADCAST_TYPE</label>
              <select
                value={formData.type || ''}
                onChange={e => setFormData?.(f => ({ ...f, type: e.target.value }))}
                onBlur={() => touch('type')}
                style={{
                  border: showError('type') ? '1px solid #E24B4A' : '0.5px solid #e0e0e0',
                }}
                className="bg-white rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none transition-all appearance-none cursor-pointer"
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
                  onBlur={() => touch('cover_url')}
                  placeholder="EXTERNAL_SIGNAL_URL"
                  style={{
                    border: showError('cover_url') ? '1px solid #E24B4A' : '0.5px solid #e0e0e0',
                  }}
                  className="flex-1 bg-white rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold focus:border-[1px] focus:border-[#FFE01A] outline-none transition-all placeholder:text-[#cccccc] placeholder:font-normal"
                />
                <ErrorLine field="cover_url" />
                
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

            <div className="flex flex-col gap-6 mb-8">
              <div className="flex flex-col gap-2">
                <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">GENERAL_DESCRIPTION</label>
                <textarea 
                  rows={3}
                  value={formData.description || ''}
                  onChange={e => setFormData?.(f => ({ ...f, description: e.target.value }))}
                  placeholder="Tell the story of this signal... what should people expect when they arrive?"
                  className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none resize-none"
                />
              </div>
            </div>

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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] text-[#999] tracking-widest uppercase">DEPARTURE_TIME</label>
                      <input 
                        type="time" 
                        value={formData.departure_time || ''} 
                        onChange={e => setFormData?.(f => ({ ...f, departure_time: e.target.value }))}
                        className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] text-[#999] tracking-widest uppercase">GUIDE_NAME</label>
                      <input 
                        type="text" 
                        value={formData.guide_name || ''} 
                        onChange={e => setFormData?.(f => ({ ...f, guide_name: e.target.value }))}
                        placeholder="e.g. Captain Hiker"
                        className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">MEETING_POINT</label>
                    <input 
                      type="text" 
                      value={formData.meeting_point || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, meeting_point: e.target.value }))}
                      placeholder="e.g. Fountain Square (north corner)"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
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
                      onBlur={() => touch('booking_url')}
                      placeholder="https://eventbrite.com/... or lu.ma/..."
                      style={{
                        border: showError('booking_url') ? '1px solid #E24B4A' : '0.5px solid #e0e0e0',
                      }}
                      className="bg-white rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <ErrorLine field="booking_url" />
                    <p className="text-[8px] text-[#bbbbbb]">Book Now button links here. Leave empty for inline booking sheet.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] text-[#999] tracking-widest uppercase">Admission</label>
                      <div className="flex gap-0 border-[0.5px] border-[#e0e0e0] rounded-[10px] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setFormData?.(f => ({ ...f, price: 0 }))}
                          style={{
                            flex: 1, padding: '11px',
                            background: formData.price === 0 ? '#FFE01A' : '#fff',
                            color:      formData.price === 0 ? '#0a0a0a' : '#999',
                            border: 'none', cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: 10,
                            fontWeight: 700, letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Free
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData?.(f => ({ ...f, price: f.price || 10 }))}
                          style={{
                            flex: 1, padding: '11px',
                            background: formData.price > 0 ? '#FFE01A' : '#fff',
                            color:      formData.price > 0 ? '#0a0a0a' : '#999',
                            border: 'none', cursor: 'pointer',
                            borderLeft: '0.5px solid #e0e0e0',
                            fontFamily: 'inherit', fontSize: 10,
                            fontWeight: 700, letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Paid
                        </button>
                      </div>
                    </div>

                    {formData.price > 0 && (
                      <div className="flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200">
                        <label className="text-[9px] text-[#999] tracking-widest uppercase">Price ($)</label>
                        <input 
                          type="number" 
                          min="1"
                          value={formData.price ?? ''} 
                          onChange={e => setFormData?.(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                          placeholder="15"
                          className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                        />
                      </div>
                    )}
                    
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
                      onBlur={() => touch('artist')}
                      placeholder="e.g. Jenny Ustick"
                      style={{
                        border: showError('artist') ? '1px solid #E24B4A' : '0.5px solid #e0e0e0',
                      }}
                      className="bg-white rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <ErrorLine field="artist" />
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
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">DISCOUNT_VALUE</label>
                    <input 
                      type="text" 
                      value={formData.discount_value || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, discount_value: e.target.value }))}
                      placeholder="e.g. 50% OFF"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
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
                      onBlur={() => touch('artist')}
                      placeholder="e.g. Marcus Miller Quartet"
                      style={{
                        border: showError('artist') ? '1px solid #E24B4A' : '0.5px solid #e0e0e0',
                      }}
                      className="bg-white rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <ErrorLine field="artist" />
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
                  <div className="field">
                    <div style={{
                      padding: '10px 14px',
                      background: '#0a2e1a',
                      border: '0.5px solid #1D9E75',
                      borderRadius: 8,
                      fontSize: 9,
                      color: '#7dd3a8',
                      letterSpacing: '0.1em',
                      fontFamily: 'monospace',
                      textTransform: 'uppercase',
                    }}>
                      ✓ Civic events are always free and open to the public
                    </div>
                  </div>
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

              {formData.type === BroadcastType.POP_UP && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">HOST_NAME</label>
                    <input 
                      type="text" 
                      value={formData.partner_name || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, partner_name: e.target.value }))}
                      placeholder="e.g. HighGrain Brewing Co."
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">OFFER_DETAILS</label>
                    <input 
                      type="text" 
                      value={formData.deal_description || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, deal_description: e.target.value }))}
                      placeholder="e.g. Sample the new IPA before it hits cans"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                  </div>
                </div>
              )}

              {formData.type === BroadcastType.DONATION && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">CAUSE / ORGANIZATION</label>
                    <input 
                      type="text" 
                      value={formData.partner_name || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, partner_name: e.target.value }))}
                      placeholder="e.g. Cincinnati Parks Foundation"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-[#999] tracking-widest uppercase">DONATION_URL</label>
                    <input 
                      type="text" 
                      value={formData.booking_url || ''} 
                      onChange={e => setFormData?.(f => ({ ...f, booking_url: e.target.value }))}
                      placeholder="https://... secure donation link"
                      className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                    />
                    <p className="text-[8px] text-[#bbbbbb]">Donate button links here</p>
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
                      touch('address');
                    }}
                    placeholder="Enter event address e.g. 1215 Elm St, Cincinnati, OH"
                    className="!rounded-[10px] !border-[#e0e0e0] !p-0"
                  />
                  <ErrorLine field="address" />
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
            <div className="flex items-center justify-between bg-[#f8f8f8] p-4 rounded-[10px] border-[0.5px] border-[#e0e0e0]">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-[#1a1a1a] font-bold tracking-widest uppercase">DAILY_RECURRENCE_MODE</label>
                <p className="text-[8px] text-[#999] uppercase tracking-wider">Perpetual schedule (ignores single start/end times)</p>
              </div>
              <button 
                type="button"
                onClick={() => setFormData?.(f => ({ ...f, is_recurring: !f.is_recurring }))}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${formData.is_recurring ? 'bg-[#FFE01A]' : 'bg-[#e0e0e0]'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${formData.is_recurring ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">
                {formData.is_recurring ? 'SCHEDULE_START_DATE' : 'EVENT_DATE'}
              </label>
              <input 
                type="date"
                value={formData.event_date || ''}
                onChange={e => setFormData?.(f => ({ ...f, event_date: e.target.value }))}
                onBlur={() => touch('event_date')}
                style={{
                  border: showError('event_date') ? '1px solid #E24B4A' : '0.5px solid #e0e0e0',
                }}
                className="bg-white rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none w-full md:w-1/2"
              />
              <ErrorLine field="event_date" />
            </div>

            {formData.is_recurring ? (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col gap-3">
                  <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">FREQUENCY</label>
                  <div className="flex flex-wrap gap-2">
                    {['daily', 'weekly', 'biweekly', 'monthly'].map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormData?.(prev => ({ ...prev, recurring_frequency: f }))}
                        className={`px-4 py-2 text-[10px] font-bold rounded-md border transition-all uppercase ${
                          formData.recurring_frequency === f
                          ? 'bg-[#FFE01A] border-[#FFE01A] text-[#0a0a0a]'
                          : 'bg-white border-[#e0e0e0] text-[#999]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {formData.recurring_frequency === 'monthly' && (
                  <div className="flex flex-col gap-3">
                    <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">WEEK_OF_MONTH</label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map(w => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setFormData?.(prev => ({ ...prev, recurring_week_of_month: w }))}
                          className={`px-4 py-2 text-[10px] font-bold rounded-md border transition-all uppercase ${
                            formData.recurring_week_of_month === w
                            ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white'
                            : 'bg-white border-[#e0e0e0] text-[#999]'
                          }`}
                        >
                          {w === 5 ? 'Last' : w === 1 ? '1st' : w === 2 ? '2nd' : w === 3 ? '3rd' : '4th'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">ACTIVE_DAYS</label>
                  <div className="flex flex-wrap gap-2">
                    {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const current = formData.recurring_days || [];
                          const next = current.includes(day) 
                            ? current.filter((d: string) => d !== day)
                            : [...current, day];
                          setFormData?.(f => ({ ...f, recurring_days: next }));
                        }}
                        className={`px-4 py-2 text-[10px] font-bold rounded-md border transition-all uppercase ${
                          (formData.recurring_days || []).includes(day)
                          ? 'bg-[#FFE01A] border-[#FFE01A] text-[#0a0a0a]'
                          : 'bg-white border-[#e0e0e0] text-[#999]'
                        }`}
                      >
                        {day === 'thu' ? 'Thur' : day.charAt(0).toUpperCase() + day.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">DEPARTURE_TIMES (24H)</label>
                  <div className="flex flex-col md:flex-row gap-4 items-start">
                    <div className="flex gap-2 w-full md:w-auto">
                      <input 
                        type="time" 
                        id="recurring-time-input"
                        className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[10px_14px] text-[12px] font-bold focus:border-[#FFE01A] outline-none h-[44px]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const input = e.target as HTMLInputElement;
                            const val = input.value;
                            if (val && !(formData.recurring_times || []).includes(val)) {
                              setFormData?.(f => ({ ...f, recurring_times: [...(f.recurring_times || []), val].sort() }));
                              input.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('recurring-time-input') as HTMLInputElement;
                          const val = input?.value;
                          if (val && !(formData.recurring_times || []).includes(val)) {
                            setFormData?.(f => ({ ...f, recurring_times: [...(f.recurring_times || []), val].sort() }));
                            input.value = '';
                          }
                        }}
                        className="bg-[#0a0a0a] text-white px-4 rounded-[10px] text-[10px] font-bold uppercase hover:bg-uh-yellow hover:text-black transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 flex-1 min-h-[44px] items-center">
                      {(formData.recurring_times || []).length === 0 && (
                        <span className="text-[10px] text-[#ccc] italic uppercase">No times added yet</span>
                      )}
                      {(formData.recurring_times || []).map((t: string) => (
                        <div key={t} className="flex items-center gap-2 bg-[#f0f0f0] text-[#1a1a1a] px-3 py-1.5 rounded-[6px] text-[10px] font-bold border-[0.5px] border-[#e0e0e0]">
                          {t}
                          <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setFormData?.(f => ({ ...f, recurring_times: f.recurring_times.filter((v: string) => v !== t) }))} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-[8px] text-[#bbbbbb] uppercase tracking-wider">Select a time and click ADD (or press ENTER)</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">DURATION (MINUTES)</label>
                  <input 
                    type="number" 
                    value={formData.duration_minutes || ''} 
                    onChange={e => setFormData?.(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))}
                    placeholder="60"
                    className="bg-white border-[0.5px] border-[#e0e0e0] rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold focus:border-[1px] focus:border-[#FFE01A] outline-none w-full md:w-1/3"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">START</label>
                  <input 
                    type="time" 
                    value={formData.start_time || ''}
                    onChange={e => setFormData?.(f => ({ ...f, start_time: e.target.value }))}
                    onBlur={() => touch('start_time')}
                    style={{
                      border: showError('start_time') ? '1px solid #E24B4A' : '0.5px solid #e0e0e0',
                    }}
                    className="bg-white rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none" 
                  />
                  <ErrorLine field="start_time" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] text-[#999] tracking-[0.15em] uppercase">END</label>
                  <input 
                    type="time" 
                    value={formData.end_time || ''}
                    onChange={e => setFormData?.(f => ({ ...f, end_time: e.target.value }))}
                    onBlur={() => touch('end_time')}
                    style={{
                      border: showError('end_time') ? '1px solid #E24B4A' : '0.5px solid #e0e0e0',
                    }}
                    className="bg-white rounded-[10px] p-[14px_16px] text-[12px] text-[#1a1a1a] font-bold uppercase focus:border-[1px] focus:border-[#FFE01A] outline-none" 
                  />
                  <ErrorLine field="end_time" />
                </div>
              </div>
            )}


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
            {(() => {
              const result = validateBroadcast(formData, traceLocked);
              const errorCount = Object.keys(result.errors).length;

              if (result.valid) {
                return (
                  <div style={{
                    padding: '12px 16px',
                    background: '#0a2e1a',
                    border: '0.5px solid #1D9E75',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 8,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M4 10l4 4 8-8"/>
                    </svg>
                    <span style={{ fontSize: 9, color: '#7dd3a8', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                      Signal ready — all checks passed
                    </span>
                  </div>
                );
              }

              return (
                <div style={{
                  padding: '12px 16px',
                  background: '#2e0a0a',
                  border: '0.5px solid #E24B4A',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 9, color: '#E24B4A', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#E24B4A" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z"/>
                      <path d="M10 7v4m0 3v.01"/>
                    </svg>
                    {errorCount} issue{errorCount > 1 ? 's' : ''} blocking transmission
                  </div>
                  {Object.values(result.errors).map((err, i) => (
                    <div key={i} style={{ fontSize: 8, color: '#ff9d9d', letterSpacing: '0.08em', fontFamily: 'monospace', paddingLeft: 20 }}>
                      · {err}
                    </div>
                  ))}
                </div>
              );
            })()}

            <button
              type="button"
              onClick={handleTransmit}
              disabled={!validateBroadcast(formData, traceLocked).valid || submitting}
              style={{
                opacity: (!validateBroadcast(formData, traceLocked).valid || submitting) ? 0.4 : 1,
                cursor: (!validateBroadcast(formData, traceLocked).valid || submitting) ? 'not-allowed' : 'pointer',
                border: validateBroadcast(formData, traceLocked).valid ? '1px solid #FFE01A' : '1px solid #444',
                color: validateBroadcast(formData, traceLocked).valid ? '#FFE01A' : '#555',
              }}
              className={`w-full p-5 text-[13px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-4 transition-all duration-300 rounded-[10px] ${
                localSuccess
                ? 'bg-[#1D9E75] text-[#0a0a0a]'
                : !validateBroadcast(formData, traceLocked).valid 
                  ? 'bg-[#1a1a1a] text-[#555]'
                  : 'bg-[#0a0a0a] text-[#FFE01A] hover:bg-[#FFE01A] hover:text-[#0a0a0a]'
              }`}
            >
              {submitting ? (
                <span className="flex items-center gap-3 animate-pulse">
                  <span className="animate-pulse">◉</span>
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
