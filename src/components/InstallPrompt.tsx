import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share, PlusSquare } from 'lucide-react';

/**
 * "Add Local Pulse to your home screen" banner.
 *
 * NFC taps still open in the browser with no download. This only appears for
 * returning walkers (2nd visit onward), never on admin/creator/checkout pages,
 * never once installed, and stays away for 14 days after a dismiss.
 *  - Android/Chrome/Edge: uses the native install prompt.
 *  - iPhone/iPad: shows the Share → Add to Home Screen steps (Apple has no prompt API).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const VISITS_KEY = 'uh_pwa_visits';
const DISMISSED_KEY = 'uh_pwa_dismissed_at';
const SESSION_KEY = 'uh_pwa_session_counted';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const MIN_VISITS = 2;
const SHOW_DELAY_MS = 8000;
const HIDDEN_PATHS = ['dashboard', 'admin', 'login', 'creator', 'sponsor', 'checkout'];

function safeGet(key: string, store: Storage = localStorage) {
  try { return store.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string, store: Storage = localStorage) {
  try { store.setItem(key, value); } catch { /* storage blocked */ }
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;
}

function isIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function countVisit(): number {
  let visits = Number(safeGet(VISITS_KEY) || '0');
  if (!safeGet(SESSION_KEY, sessionStorage)) {
    visits += 1;
    safeSet(VISITS_KEY, String(visits));
    safeSet(SESSION_KEY, '1', sessionStorage);
  }
  return visits;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios] = useState(() => typeof navigator !== 'undefined' && isIOS());

  useEffect(() => {
    if (isStandalone()) return;
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.some((p) => HIDDEN_PATHS.includes(p))) return;

    const visits = countVisit();
    const dismissedAt = Number(safeGet(DISMISSED_KEY) || '0');
    const eligible = visits >= MIN_VISITS && Date.now() - dismissedAt > SNOOZE_MS;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    const timer = eligible ? window.setTimeout(() => setVisible(true), SHOW_DELAY_MS) : undefined;

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    safeSet(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'accepted') setVisible(false);
    else dismiss();
  };

  // Only show when there is something the walker can actually do.
  const show = visible && (ios || deferred !== null);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[3000] w-[calc(100%-2rem)] max-w-sm bg-uh-black text-white rounded-3xl shadow-2xl border border-uh-yellow/40 p-4"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          role="dialog"
          aria-label="Add Local Pulse to your home screen"
        >
          <div className="flex items-start gap-3">
            <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-2xl shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-uh-yellow font-black text-[11px] tracking-widest uppercase">
                Keep Local Pulse on your phone
              </div>
              {ios ? (
                <p className="text-xs text-white/75 mt-1 leading-snug">
                  Tap <Share size={13} className="inline -mt-0.5" aria-label="Share" /> then{' '}
                  <span className="font-bold text-white">Add to Home Screen</span>{' '}
                  <PlusSquare size={13} className="inline -mt-0.5" aria-hidden="true" /> to open the city's pulse in one tap.
                </p>
              ) : (
                <p className="text-xs text-white/75 mt-1 leading-snug">
                  Your passport, saved hubs and live signals, one tap from your home screen.
                </p>
              )}
              {!ios && (
                <button
                  onClick={install}
                  className="mt-3 px-5 py-2 rounded-full bg-uh-yellow text-uh-black font-black text-[11px] tracking-widest uppercase"
                >
                  Install app
                </button>
              )}
            </div>
            <button onClick={dismiss} aria-label="Not now" className="text-white/50 hover:text-white p-1 -m-1">
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
