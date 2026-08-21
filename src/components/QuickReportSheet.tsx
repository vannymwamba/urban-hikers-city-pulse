import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Key, Check, Loader2, List } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface QuickReportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function QuickReportSheet({ isOpen, onClose, nodeId }: QuickReportSheetProps) {
  const navigate = useNavigate();
  const [type, setType] = useState<'lost' | 'found' | null>(null);
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const isValid = type && description.trim() && contact.trim();

  const handleSubmit = async () => {
    if (!isValid || !nodeId) return;
    setIsSubmitting(true);
    const code = makeCode();
    try {
      await addDoc(collection(db, 'lost_found'), {
        node_id: nodeId,
        type,
        category: 'other', // Defaulted to other for quick form
        description: description.trim(),
        location: 'Reported at this node',
        contact: contact.trim(),
        publicContact: false,
        status: 'open',
        resolveCode: code,
        reportedAt: serverTimestamp(),
      });
      setSubmittedCode(code);
    } catch (err) {
      console.error('Error submitting report:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setType(null);
    setDescription('');
    setContact('');
    setSubmittedCode(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={resetAndClose}
      />
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#1A1A1A] rounded-t-3xl z-50 animate-in slide-in-from-bottom duration-300 pb-safe">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Quick Report</h2>
            <button onClick={resetAndClose} className="p-2 bg-white/5 rounded-full text-[#8A928B] hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {submittedCode ? (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 bg-[#F2C94C]/20 rounded-full flex items-center justify-center mb-4 text-[#F2C94C]">
                <Check size={32} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Report Posted</h3>
              <p className="text-sm text-[#8A928B] mb-6">
                Your report has been securely posted. Save this code if you need to resolve or delete it later:
              </p>
              <div className="bg-black/50 border border-white/10 rounded-xl px-6 py-4 font-mono text-2xl tracking-widest text-[#F2C94C] font-bold mb-6">
                {submittedCode}
              </div>
              <button 
                onClick={resetAndClose}
                className="w-full bg-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/20 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 mb-2">
                <button
                  className={`flex items-center justify-center gap-2 border-[1.5px] rounded-xl p-4 text-sm font-bold transition-colors ${
                    type === 'lost'
                      ? 'border-[#E24A3B] bg-[#E24A3B]/10 text-white'
                      : 'border-white/10 bg-black/30 text-[#8A928B] hover:border-white/20 hover:text-white'
                  }`}
                  onClick={() => setType('lost')}
                >
                  <Key size={18} /> I lost something
                </button>
                <button
                  className={`flex items-center justify-center gap-2 border-[1.5px] rounded-xl p-4 text-sm font-bold transition-colors ${
                    type === 'found'
                      ? 'border-[#3D8BFF] bg-[#3D8BFF]/10 text-white'
                      : 'border-white/10 bg-black/30 text-[#8A928B] hover:border-white/20 hover:text-white'
                  }`}
                  onClick={() => setType('found')}
                >
                  <Search size={18} /> I found something
                </button>
              </div>

              {type && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-3">
                  <input
                    className="w-full bg-black/50 border-[1.5px] border-white/10 rounded-xl px-4 py-4 text-[15px] text-white placeholder-[#5C6068] focus:outline-none focus:border-[#F2C94C]/50 transition-colors"
                    placeholder={type === 'lost' ? 'What was it? (e.g., Red wallet)' : 'What did you find? (e.g., House keys)'}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <input
                    className="w-full bg-black/50 border-[1.5px] border-white/10 rounded-xl px-4 py-4 text-[15px] text-white placeholder-[#5C6068] focus:outline-none focus:border-[#F2C94C]/50 transition-colors"
                    placeholder="Your phone or email (hidden by default)"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                  <button
                    className="w-full bg-[#E24A3B] text-white border-none rounded-xl py-4 mt-2 font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isValid || isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Post Report'}
                  </button>
                </div>
              )}

              {!type && (
                <button
                  onClick={() => {
                    onClose();
                    navigate('/lost-and-found');
                  }}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-4 rounded-xl border border-white/10 text-[#8A928B] hover:text-white hover:bg-white/5 transition-colors font-medium text-sm"
                >
                  <List size={16} /> Browse All Active Reports
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
