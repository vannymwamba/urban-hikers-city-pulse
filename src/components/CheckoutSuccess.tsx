import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CheckoutSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const finalizeCheckout = async () => {
      if (!sessionId) {
        setStatus('error');
        setError('No session ID found.');
        return;
      }

      try {
        const response = await fetch('/api/checkout/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus('success');
          setResult(data);
          // Redirect after a delay
          setTimeout(() => {
            if (data.type === 'broadcast') {
              navigate(`/tap/${data.nodeId || 'otr-alpha-01'}`);
            } else {
              navigate(-2); // Go back to where they were
            }
          }, 3000);
        } else {
          setStatus('error');
          setError(data.error || 'Finalization failed.');
        }
      } catch (err) {
        console.error('Finalize error:', err);
        setStatus('error');
        setError('Network error during finalization.');
      }
    };

    finalizeCheckout();
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-8 text-center text-white">
      <AnimatePresence mode="wait">
        {status === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <Loader2 className="animate-spin text-[#FFE01A] mb-4" size={48} />
            <h2 className="text-xl font-bold tracking-tighter uppercase">Verifying_Payment...</h2>
            <p className="text-white/40 text-xs mt-2 uppercase tracking-widest">Securing your broadcast signal</p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center"
          >
            <div className="w-20 h-20 bg-[#22C55E] rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.4)]">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-bold tracking-tighter uppercase mb-2">Payment_Confirmed</h2>
            <p className="text-white/60 text-sm max-w-xs mb-8">
              {result?.type === 'broadcast' 
                ? 'Your signal is now broadcasting to all nodes across the city.' 
                : 'Your spot for the walking event has been secured. Check your email for details.'}
            </p>
            <div className="text-[10px] tracking-[0.3em] uppercase opacity-40 animate-pulse">
              Redirecting_to_Sector...
            </div>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center"
          >
            <AlertCircle className="text-[#EF4444] mb-4" size={48} />
            <h2 className="text-xl font-bold tracking-tighter uppercase text-[#EF4444]">Verification_Failed</h2>
            <p className="text-white/60 text-sm mt-2 mb-8">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-8 py-3 bg-white text-black font-bold rounded-full uppercase text-xs tracking-widest"
            >
              Return Home
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
