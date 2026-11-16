import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Check, Loader2, X, LogIn } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase';

interface ProposeNodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  neighborhood?: string | null;
}

export function ProposeNodeSheet({ isOpen, onClose, neighborhood }: ProposeNodeSheetProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requiresSignIn, setRequiresSignIn] = useState(false);

  const isValid = name.trim() && reason.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitError(null);
    setRequiresSignIn(false);
    setIsSubmitting(true);

    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        try {
          const anonRes = await signInAnonymously(auth);
          currentUser = anonRes.user;
        } catch (authErr: any) {
          if (authErr?.code === 'auth/admin-restricted-operation' || authErr?.code === 'auth/operation-not-allowed') {
            setRequiresSignIn(true);
            setSubmitError('Please sign in to submit a spot suggestion so we can notify you when it goes live.');
          } else {
            setSubmitError('Could not verify your session. Please try again.');
          }
          return;
        }
      }

      const uid = currentUser?.uid;
      if (!uid) {
        setRequiresSignIn(true);
        setSubmitError('Please sign in to submit a spot suggestion.');
        return;
      }

      // Best-effort location — never blocks submission if denied or unsupported.
      let latitude: number | null = null;
      let longitude: number | null = null;
      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch {
          // Ignore — address/name/reason are enough to review.
        }
      }

      const trimmedName = name.trim();
      const docRef = await addDoc(collection(db, 'node_proposals'), {
        name: trimmedName,
        address: address.trim() || null,
        reason: reason.trim(),
        latitude,
        longitude,
        neighborhood: neighborhood || null,
        proposed_by_uid: uid,
        proposed_by_email: currentUser?.email || null,
        status: 'pending',
        created_at: serverTimestamp(),
      });

      window.dispatchEvent(
        new CustomEvent('uh-activity-notification', {
          detail: {
            key: `local-proposal:${docRef.id}`,
            type: 'proposal_submitted',
            title: 'Spot suggestion submitted',
            body: `"${trimmedName}" was sent for review. You'll be notified here as soon as it goes live.`,
            created_ms: Date.now(),
          },
        })
      );

      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting node proposal:', err);
      setSubmitError('Unable to submit right now. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setName('');
    setAddress('');
    setReason('');
    setSubmitted(false);
    setSubmitError(null);
    setRequiresSignIn(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] animate-in fade-in duration-200"
        onClick={resetAndClose}
      />
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#1A1A1A] rounded-t-3xl z-[130] animate-in slide-in-from-bottom duration-300 pb-24 max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Suggest a Spot</h2>
            <button onClick={resetAndClose} className="p-2 bg-white/5 rounded-full text-[#8A928B] hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 bg-[#F2C94C]/20 rounded-full flex items-center justify-center mb-4 text-[#F2C94C]">
                <Check size={32} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Thanks for the tip</h3>
              <p className="text-sm text-[#8A928B] mb-6">
                We'll take a look. If it's a good fit, we'll add it as a real stop on the trail.
              </p>
              <button
                onClick={resetAndClose}
                className="w-full bg-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/20 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[#8A928B]">
                Know a spot that deserves a Local Pulse stop? Tell us where and why.
              </p>
              <input
                className="w-full bg-black/50 border-[1.5px] border-white/10 rounded-xl px-4 py-4 text-[15px] text-white placeholder-[#5C6068] focus:outline-none focus:border-[#F2C94C]/50 transition-colors"
                placeholder="Place name (e.g., Redtree Coffee & Art)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="w-full bg-black/50 border-[1.5px] border-white/10 rounded-xl px-4 py-4 text-[15px] text-white placeholder-[#5C6068] focus:outline-none focus:border-[#F2C94C]/50 transition-colors"
                placeholder="Address (optional)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <textarea
                className="w-full bg-black/50 border-[1.5px] border-white/10 rounded-xl px-4 py-4 text-[15px] text-white placeholder-[#5C6068] focus:outline-none focus:border-[#F2C94C]/50 transition-colors resize-none"
                placeholder="Why should this be a stop?"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              {submitError && (
                <div className="rounded-xl border border-[#E24A3B]/40 bg-[#E24A3B]/10 px-4 py-3 text-xs text-[#F8B4AD] flex flex-col gap-2">
                  <span>{submitError}</span>
                  {requiresSignIn && (
                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.setItem('uh_login_redirect', window.location.pathname);
                        resetAndClose();
                        navigate('/login');
                      }}
                      className="self-start inline-flex items-center gap-1.5 bg-[#F2C94C] text-black font-bold px-3 py-1.5 rounded-lg text-xs"
                    >
                      <LogIn size={13} /> Sign in
                    </button>
                  )}
                </div>
              )}
              <button
                className="w-full bg-[#F2C94C] text-black border-none rounded-xl py-4 mt-2 font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isValid || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <MapPin size={18} /> Submit Suggestion
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
