import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export const CheckoutCancel: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-hud-bg flex flex-col items-center justify-center p-6 text-hud-magenta font-sans">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-hud-magenta/5 border border-hud-magenta/20 rounded-[32px] p-8 text-center shadow-2xl backdrop-blur-xl"
      >
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
          <AlertCircle size={40} />
        </div>
        
        <h1 className="text-2xl font-black tracking-tighter uppercase mb-2">Payment_Cancelled</h1>
        <p className="text-hud-magenta/60 text-sm mb-8 leading-relaxed">
          The transaction was not completed. Your signal has not been ignited yet.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate(-1)}
            className="w-full py-4 bg-hud-magenta text-hud-bg rounded-[20px] font-black tracking-widest uppercase flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <RefreshCw size={18} /> Try_Again
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="w-full py-4 border border-hud-magenta/20 text-hud-magenta rounded-[20px] font-black tracking-widest uppercase flex items-center justify-center gap-2 hover:bg-hud-magenta/5 transition-all"
          >
            <ArrowLeft size={18} /> Return_to_Base
          </button>
        </div>
      </motion.div>

      <div className="mt-12 text-[10px] tracking-[0.4em] font-bold uppercase opacity-30">
        Urban_Hikers_Protocol_v2.5
      </div>
    </div>
  );
};
