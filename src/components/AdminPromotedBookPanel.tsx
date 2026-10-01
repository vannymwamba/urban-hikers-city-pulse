import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Loader2, Save, BookOpen, Music, Upload, RotateCcw, CheckCircle2, AlertCircle, FileAudio, Link as LinkIcon } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import { PromotedBook } from './PromotedBook';
import type { PromotedBookConfig } from '../types';
import { normalizeAudioUrl } from '../utils/audioUrlHelper';

interface AdminPromotedBookPanelProps {
  setHudMessage: (msg: { text: string; type: 'info' | 'error' } | null) => void;
}

const DEFAULT_BOOK_CONFIG: PromotedBookConfig = {
  author_name: 'MARK E. SCOTT',
  book_title: 'DRUNK LOG',
  copy: 'Listen to a 45 second sample from the book.',
  duration_str: '0:45',
  cover_url: '/drunk_log_cover.jpg',
  audio_url: '',
  purchase_url: ''
};

export const AdminPromotedBookPanel: React.FC<AdminPromotedBookPanelProps> = ({ setHudMessage }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [bookConfig, setBookConfig] = useState<PromotedBookConfig>(DEFAULT_BOOK_CONFIG);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'globalSponsors', 'config'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.promotedBook) {
            setBookConfig({
              ...DEFAULT_BOOK_CONFIG,
              ...data.promotedBook
            });
          }
        }
      } catch (err) {
        console.error("Error fetching promoted book configuration:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      // Merge with existing globalSponsors doc to preserve hero, wayfinding, etc.
      const docRef = doc(db, 'globalSponsors', 'config');
      await setDoc(docRef, {
        promotedBook: bookConfig
      }, { merge: true });

      setHudMessage({ text: 'PROMOTED_BOOK_CONFIG_SAVED', type: 'info' });
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'globalSponsors');
      setHudMessage({ text: 'FAILED_TO_SAVE_BOOK_CONFIG', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetToDefault = () => {
    setBookConfig(DEFAULT_BOOK_CONFIG);
    setHudMessage({ text: 'RESET_TO_DEFAULTS', type: 'info' });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict 5MB limit check
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setHudMessage({ 
        text: `Cover image exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a file below 5MB.`, 
        type: 'error' 
      });
      return;
    }

    setUploadingCover(true);
    try {
      // First try direct /api/upload-media endpoint (reliable in all container environments)
      const base64Data = await fileToBase64(file);
      const res = await fetch('/api/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          base64Data,
          contentType: file.type,
          folder: 'covers'
        })
      });

      if (res.ok) {
        const json = await res.json();
        setBookConfig(prev => ({ ...prev, cover_url: json.url }));
        setHudMessage({ text: 'COVER_IMAGE_UPLOADED', type: 'info' });
        return;
      }

      // Fallback: Firebase Storage
      const storageRef = ref(storage, `promoted_books/covers/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytesResumable(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setBookConfig(prev => ({ ...prev, cover_url: url }));
      setHudMessage({ text: 'COVER_IMAGE_UPLOADED', type: 'info' });
    } catch (err: any) {
      console.error("Cover upload error:", err);
      setHudMessage({ text: err?.message || 'COVER_UPLOAD_FAILED', type: 'error' });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict 5MB limit check as requested
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setHudMessage({ 
        text: `Audio file exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please upload an audio file below 5MB.`, 
        type: 'error' 
      });
      return;
    }

    setUploadingAudio(true);
    try {
      // 1. Try server media upload endpoint first for instantaneous reliable storage
      const base64Data = await fileToBase64(file);
      const res = await fetch('/api/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          base64Data,
          contentType: file.type || 'audio/mpeg',
          folder: 'audio'
        })
      });

      if (res.ok) {
        const json = await res.json();
        setBookConfig(prev => ({ ...prev, audio_url: json.url }));
        setHudMessage({ text: 'AUDIO_SAMPLE_UPLOADED (<5MB)', type: 'info' });
        return;
      }

      // 2. Fallback to Firebase Storage
      const storageRef = ref(storage, `promoted_books/audio/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytesResumable(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setBookConfig(prev => ({ ...prev, audio_url: url }));
      setHudMessage({ text: 'AUDIO_SAMPLE_UPLOADED', type: 'info' });
    } catch (err: any) {
      console.error("Audio upload error:", err);
      setHudMessage({ text: err?.message || 'AUDIO_UPLOAD_FAILED', type: 'error' });
    } finally {
      setUploadingAudio(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center items-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#FFE01A]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h3 className="text-xs font-black tracking-widest uppercase text-black flex items-center gap-2">
            <BookOpen size={14} className="text-[#F2C94C]" />
            PROMOTED_WRITER_&_AUDIO_MODULE
          </h3>
          <p className="text-[10px] text-[#888] tracking-wider uppercase mt-1">
            Configure the sponsored local writer card, book title, narrator audio sample, and duration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#e0e0e0] text-[#666] text-[9px] font-bold tracking-widest uppercase rounded-lg hover:border-black transition-all"
            title="Reset to Mark E. Scott / Drunk Log defaults"
          >
            <RotateCcw size={11} />
            Reset Default
          </button>
          <button 
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-black text-[#FFE01A] text-[9px] font-black tracking-widest uppercase rounded-lg hover:scale-105 transition-all disabled:opacity-50 shadow-sm"
          >
            {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save size={12} />}
            {submitting ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form: Fields to edit author, title, copy, duration, audio & cover */}
        <div className="lg:col-span-7 bg-white border border-[#e0e0e0] rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-black border-b border-[#f0f0f0] pb-3">
            Writer & Publication Details
          </h4>

          {/* Author Name */}
          <div>
            <label className="text-[9px] text-[#888] font-bold tracking-widest uppercase mb-1.5 block">
              Author / Writer Name *
            </label>
            <input 
              type="text"
              value={bookConfig.author_name}
              onChange={e => setBookConfig(prev => ({ ...prev, author_name: e.target.value.toUpperCase() }))}
              placeholder="e.g. MARK E. SCOTT"
              className="w-full bg-[#f8f8f8] text-black border border-[#e0e0e0] focus:border-[#F2C94C] rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none transition-colors"
            />
          </div>

          {/* Book Title */}
          <div>
            <label className="text-[9px] text-[#888] font-bold tracking-widest uppercase mb-1.5 block">
              Book / Publication Title *
            </label>
            <input 
              type="text"
              value={bookConfig.book_title}
              onChange={e => setBookConfig(prev => ({ ...prev, book_title: e.target.value.toUpperCase() }))}
              placeholder="e.g. DRUNK LOG"
              className="w-full bg-[#f8f8f8] text-black border border-[#e0e0e0] focus:border-[#F2C94C] rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none transition-colors"
            />
          </div>

          {/* Editorial Copy */}
          <div>
            <label className="text-[9px] text-[#888] font-bold tracking-widest uppercase mb-1.5 block">
              Teaser / Editorial Copy
            </label>
            <input 
              type="text"
              value={bookConfig.copy}
              onChange={e => setBookConfig(prev => ({ ...prev, copy: e.target.value }))}
              placeholder="e.g. Listen to a 45 second sample from the book."
              className="w-full bg-[#f8f8f8] text-black border border-[#e0e0e0] focus:border-[#F2C94C] rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors"
            />
          </div>

          {/* Audio Duration */}
          <div>
            <label className="text-[9px] text-[#888] font-bold tracking-widest uppercase mb-1.5 block">
              Audio Duration Display (e.g. 0:45)
            </label>
            <input 
              type="text"
              value={bookConfig.duration_str}
              onChange={e => setBookConfig(prev => ({ ...prev, duration_str: e.target.value }))}
              placeholder="0:45"
              className="w-full bg-[#f8f8f8] text-black border border-[#e0e0e0] focus:border-[#F2C94C] rounded-lg px-3.5 py-2.5 text-sm font-mono outline-none transition-colors"
            />
          </div>

          {/* Audio Track Sample URL & Upload */}
          <div className="bg-[#fcfcfc] p-4 rounded-xl border border-[#ededed] space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-[9px] text-[#222] font-black tracking-widest uppercase flex items-center gap-1.5">
                <FileAudio size={12} className="text-[#F2C94C]" />
                Audio Sample Track (File &lt; 5MB or Streaming Link)
              </label>
              <span className="text-[9px] font-mono font-bold text-[#888] bg-black/5 px-2 py-0.5 rounded">
                Max 5MB
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input 
                  type="text"
                  value={bookConfig.audio_url || ''}
                  onChange={e => setBookConfig(prev => ({ ...prev, audio_url: e.target.value }))}
                  placeholder="Paste audio link (MP3, WAV, Google Drive, Dropbox, etc.)"
                  className="w-full bg-white text-black border border-[#e0e0e0] focus:border-[#F2C94C] rounded-lg pl-8 pr-3 py-2.5 text-xs outline-none transition-colors"
                />
                <LinkIcon size={12} className="absolute left-2.5 top-3.5 text-black/40" />
              </div>

              <label className="cursor-pointer px-4 bg-black hover:bg-black/85 text-[#FFE01A] rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center min-w-[110px] h-10 shrink-0 shadow-sm">
                {uploadingAudio ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <span className="flex items-center gap-1.5"><Upload size={12} /> Upload &lt;5MB</span>
                )}
                <input 
                  type="file" 
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" 
                  className="hidden" 
                  onChange={handleAudioUpload}
                />
              </label>
            </div>

            {bookConfig.audio_url && (
              <div className="flex items-center justify-between text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg">
                <span className="truncate max-w-[280px] font-mono flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                  {bookConfig.audio_url}
                </span>
                <button
                  type="button"
                  onClick={() => setBookConfig(prev => ({ ...prev, audio_url: '' }))}
                  className="text-red-500 hover:text-red-700 font-bold ml-2 text-[9px] uppercase tracking-wider"
                >
                  Remove
                </button>
              </div>
            )}

            <p className="text-[9px] text-[#888] leading-normal">
              • <strong>Attach link</strong>: Paste direct audio link (.mp3, .wav, Google Drive, or Dropbox link). Drive links are automatically normalized for streaming.<br />
              • <strong>Upload file</strong>: Select any audio file under 5MB (MP3, WAV, M4A).
            </p>
          </div>

          {/* Book Cover Image URL & Upload */}
          <div className="bg-[#fcfcfc] p-4 rounded-xl border border-[#ededed] space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-[9px] text-[#222] font-black tracking-widest uppercase block">
                Book Cover Thumbnail (File &lt; 5MB or URL)
              </label>
              <span className="text-[9px] font-mono font-bold text-[#888] bg-black/5 px-2 py-0.5 rounded">
                Max 5MB
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text"
                value={bookConfig.cover_url}
                onChange={e => setBookConfig(prev => ({ ...prev, cover_url: e.target.value }))}
                placeholder="/drunk_log_cover.jpg or https://..."
                className="flex-1 bg-white text-black border border-[#e0e0e0] focus:border-[#F2C94C] rounded-lg px-3.5 py-2.5 text-xs outline-none transition-colors"
              />
              <label className="cursor-pointer px-4 bg-black hover:bg-black/85 text-[#FFE01A] rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center min-w-[110px] h-10 shrink-0 shadow-sm">
                {uploadingCover ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <span className="flex items-center gap-1.5"><Upload size={12} /> Cover &lt;5MB</span>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleCoverUpload}
                />
              </label>
            </div>
          </div>

          {/* Purchase / External Link */}
          <div>
            <label className="text-[9px] text-[#888] font-bold tracking-widest uppercase mb-1.5 block">
              Purchase or Author Website Link (Optional)
            </label>
            <input 
              type="text"
              value={bookConfig.purchase_url || ''}
              onChange={e => setBookConfig(prev => ({ ...prev, purchase_url: e.target.value }))}
              placeholder="https://..."
              className="w-full bg-[#f8f8f8] text-black border border-[#e0e0e0] focus:border-[#F2C94C] rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors"
            />
          </div>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-[#0B0B0D] rounded-2xl p-6 border border-white/10 shadow-xl flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-4 border-b border-white/10 pb-2">
              <span className="font-mono text-[9px] font-bold text-[#F2C94C] tracking-widest uppercase">
                LIVE_COMPONENT_PREVIEW
              </span>
              <span className="font-mono text-[8px] text-white/40 uppercase">
                Click Play to test audio
              </span>
            </div>

            {/* Render PromotedBook with live editing state */}
            <div className="py-6 w-full flex justify-center">
              <PromotedBook config={bookConfig} />
            </div>

            <div className="text-[10px] text-white/50 text-center font-mono mt-2">
              Changes update in real-time in this preview. Click <strong>SAVE CONFIGURATION</strong> to persist to Firestore.
            </div>
          </div>

          <div className="bg-white border border-[#e0e0e0] rounded-2xl p-5 text-xs text-[#555] space-y-2">
            <h5 className="font-bold text-black uppercase text-[10px] tracking-wider">Features Included:</h5>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li><strong>HTML5 Audio + Web Audio API</strong>: Works seamlessly with any uploaded sample audio URL or generates an immediate ambient narration tone when clicked.</li>
              <li><strong>Toggling Play/Pause State</strong>: Circular yellow action button toggles between play/pause icons with active pulsing waveforms and duration display.</li>
              <li><strong>Real-time Artist Page Sync</strong>: The Artist NFC discovery page automatically renders these dynamic book promotion details across all visitors.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
