import React, { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { Upload, X, ImageIcon, AlertCircle } from 'lucide-react';

interface LogoUploadProps {
  partnerId: string;
  currentLogoUrl?: string;
  onUploadComplete: (downloadURL: string) => void;
}

export const LogoUpload: React.FC<LogoUploadProps> = ({ partnerId, currentLogoUrl, onUploadComplete }) => {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError('INVALID_FILE_TYPE: PNG, JPG, or SVG only.');
      return;
    }

    if (file.size > 500 * 1024) {
      setError('FILE_TOO_LARGE: Max 500KB.');
      return;
    }

    setError(null);
    uploadFile(file);
  };

  const uploadFile = (file: File) => {
    const extension = file.name.split('.').pop();
    const storagePath = `sponsors/${partnerId}/logo.${extension}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      },
      (err) => {
        console.error('Upload error:', err);
        setError('UPLOAD_FAILED: Check permissions.');
        setProgress(null);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        onUploadComplete(downloadURL);
        setProgress(null);
      }
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div 
        onClick={() => fileInputRef.current?.click()}
        className={`relative w-32 h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
          error ? 'border-hud-magenta bg-hud-magenta/5' : 'border-white/20 hover:border-hud-yellow bg-white/5'
        }`}
      >
        {currentLogoUrl && !progress ? (
          <img 
            src={currentLogoUrl} 
            alt="Partner Logo" 
            className="w-full h-full object-contain p-2"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/40">
            <Upload size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Upload Logo</span>
          </div>
        )}

        {progress !== null && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4">
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-hud-yellow transition-all duration-300" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-black text-hud-yellow">{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-hud-magenta text-[10px] font-bold uppercase">
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
        accept=".png,.jpg,.jpeg,.svg"
      />
      
      <p className="text-[9px] opacity-40 uppercase tracking-wider">
        PNG, JPG, SVG // MAX 500KB
      </p>
    </div>
  );
};
