import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useWrapData } from '../hooks/useWrapData';
import { WrapDeck } from '../components/WrapDeck';
import { AlertTriangle, Loader2 } from 'lucide-react';

export function WrapPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [searchParams] = useSearchParams();
  
  // Default to current year
  const currentYear = new Date().getFullYear().toString();
  const season = searchParams.get('season') || currentYear;

  const { data, loading, error } = useWrapData(vendorId || '', season);

  useEffect(() => {
    if (data) {
      document.title = `${data.vendorName}'s ${season} Pulse Wrap`;

      // Set og:description
      let metaDesc = document.querySelector('meta[property="og:description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('property', 'og:description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', `I reached ${data.totalTaps.toLocaleString()} people in Cincinnati.`);
    }
  }, [data, season]);

  if (loading) {
    return (
      <div 
        className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center font-sans px-6"
        id="wrap-loading-screen"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="animate-spin text-[#FFE01A]" size={40} />
          <div className="text-sm font-mono tracking-widest text-[#FFE01A] uppercase animate-pulse">
            LOADING_PULSE_WRAP_DATACYCLE...
          </div>
          <div className="text-xs text-neutral-500 font-mono">
            SECURE_ID: {vendorId || 'UNKNOWN'} // SEASON: {season}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div 
        className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center font-sans px-8 text-center"
        id="wrap-error-screen"
      >
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 p-8 rounded-lg space-y-6">
          <div className="flex justify-center text-red-500">
            <AlertTriangle size={48} className="animate-bounce" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-widest uppercase text-white font-mono">
              WRAP_INITIAL_DECRYPTION_FAILED
            </h1>
            <p className="text-neutral-400 text-sm leading-relaxed" id="wrap-error-message">
              {error || 'The requested local pulse registry document was not found or could not be verified by our administrative gates.'}
            </p>
          </div>
          <div className="pt-4 border-t border-neutral-850">
            <button 
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 border border-neutral-700 hover:border-[#FFE01A] hover:text-[#FFE01A] transition-all font-bold text-xs uppercase tracking-widest font-mono cursor-pointer bg-transparent"
              id="error-return-home-btn"
            >
              RETURN_TO_BASE_OPS
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <WrapDeck data={data} onClose={() => window.location.href = '/'} />;
}
