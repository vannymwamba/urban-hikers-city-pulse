import React, { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { Upload, X, ImageIcon, AlertCircle, RefreshCw } from 'lucide-react';

interface LogoUploadProps {
  partnerId: string;
  currentLogoUrl?: string;
  onUploadComplete: (downloadURL: string) => void;
}

export const LogoUpload: React.FC<LogoUploadProps> = ({ partnerId, currentLogoUrl, onUploadComplete }) => {
  const [progress, setProgress] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('INVALID_FILE_TYPE: PNG, JPG, SVG, or WEBP only.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // Max 5MB before compression
      setError('FILE_TOO_LARGE: Max 5MB.');
      return;
    }

    // Cleanup previous preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    // Immediate local preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    
    setError(null);
    setIsProcessing(true);
    await uploadFile(file);
    setIsProcessing(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onUploadComplete('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const compressImage = (file: File): Promise<Blob | File> => {
    // Don't compress SVGs
    if (file.type === 'image/svg+xml') return Promise.resolve(file);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // If the compressed version is actually larger (rare but possible for tiny files), use original
                if (blob.size > file.size) {
                  resolve(file);
                } else {
                  resolve(blob);
                }
              } else {
                resolve(file);
              }
            },
            'image/webp',
            0.85
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const uploadFile = async (file: File) => {
    setProgress(0);
    setError(null);

    try {
      // 1. Compress image if applicable
      const uploadData = await compressImage(file);
      
      // 2. Prepare storage path
      const extension = file.type === 'image/svg+xml' ? 'svg' : 'webp';
      const storagePath = `sponsors/${partnerId}/logo_${Date.now()}.${extension}`;
      const storageRef = ref(storage, storagePath);
      
      // 3. Start upload
      const uploadTask = uploadBytesResumable(storageRef, uploadData);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
        },
        (err) => {
          console.error('Upload error:', err);
          setError('UPLOAD_FAILED: Check connection/permissions.');
          setProgress(null);
          setPreviewUrl(null);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            onUploadComplete(downloadURL);
            setProgress(null);
          } catch (err) {
            console.error('URL error:', err);
            setError('FAILED_TO_GET_URL');
            setProgress(null);
          }
        }
      );
    } catch (err) {
      console.error('Compression/Upload error:', err);
      setError('PROCESSING_FAILED');
      setProgress(null);
    }
  };

  const displayUrl = previewUrl || currentLogoUrl;

  return (
    <div className="flex flex-col gap-3">
      <div 
        onClick={() => !progress && fileInputRef.current?.click()}
        className={`relative group w-32 h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
          error ? 'border-hud-magenta bg-hud-magenta/5' : 'border-white/20 hover:border-hud-yellow bg-white/5'
        } ${progress !== null ? 'cursor-wait opacity-80' : ''}`}
      >
        {displayUrl ? (
          <img 
            src={displayUrl} 
            alt="Partner Logo" 
            className={`w-full h-full object-contain p-2 transition-opacity duration-300 ${progress !== null || isProcessing ? 'opacity-20' : 'opacity-100'}`}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/40">
            <ImageIcon size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Upload Logo</span>
          </div>
        )}

        {(progress !== null || isProcessing) && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center p-4">
            {isProcessing && progress === null ? (
              <div className="flex flex-col items-center gap-2">
                <RefreshCw size={20} className="text-hud-yellow animate-spin" />
                <span className="text-[8px] font-bold text-white/60 uppercase">Processing...</span>
              </div>
            ) : (
              <>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full bg-hud-yellow shadow-[0_0_10px_rgba(245,200,0,0.5)] transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-black text-hud-yellow tracking-tighter">{Math.round(progress || 0)}%</span>
                <span className="text-[8px] font-bold text-white/40 uppercase mt-1">Uploading...</span>
              </>
            )}
          </div>
        )}

        {displayUrl && !progress && (
          <button 
            onClick={handleRemove}
            className="absolute top-1 right-1 p-1 bg-hud-magenta text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={12} />
          </button>
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
        PNG, JPG, SVG, WEBP // MAX 2MB
      </p>
    </div>
  );
};
