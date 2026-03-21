import React, { useState, useRef, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, UploadTask } from 'firebase/storage';
import { storage, db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Upload, X, ImageIcon, AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';

interface LogoUploadProps {
  partnerId: string;
  currentLogoUrl?: string;
  onLogoUploaded: (downloadURL: string) => void;
}

export const LogoUpload: React.FC<LogoUploadProps> = ({ partnerId, currentLogoUrl, onLogoUploaded }) => {
  const [progress, setProgress] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTaskRef = useRef<UploadTask | null>(null);

  // Reset state when currentLogoUrl changes (e.g. form reset)
  useEffect(() => {
    if (!currentLogoUrl) {
      setPreviewUrl(null);
      setError(null);
      setProgress(null);
      setIsProcessing(false);
      if (uploadTaskRef.current) {
        uploadTaskRef.current.cancel();
        uploadTaskRef.current = null;
      }
    }
  }, [currentLogoUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (uploadTaskRef.current) {
        uploadTaskRef.current.cancel();
      }
    };
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    startUpload(file);
  };

  const startUpload = async (file: File) => {
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

    // Cancel previous upload if any
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
    }

    // Cleanup previous preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setLastFile(file);
    setError(null);
    setIsProcessing(true);
    setProgress(0);

    try {
      // 1. Compress image if applicable
      const uploadData = await compressImage(file);
      
      // 2. Prepare storage path
      const extension = file.type === 'image/svg+xml' ? 'svg' : 'webp';
      const storagePath = partnerId === 'temp' 
        ? `sponsors/temp/logo_${Date.now()}.${extension}`
        : `partners/${partnerId}/logo/logo_${Date.now()}.${extension}`;
      const storageRef = ref(storage, storagePath);
      
      // 3. Start upload
      const uploadTask = uploadBytesResumable(storageRef, uploadData);
      uploadTaskRef.current = uploadTask;

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
        },
        (err) => {
          if (err.code === 'storage/canceled') return;
          console.error('Upload error:', err);
          setError('UPLOAD_FAILED: Check connection/permissions.');
          setProgress(null);
          setIsProcessing(false);
          setPreviewUrl(null);
          uploadTaskRef.current = null;
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Firestore write-back if not a temporary ID
            if (partnerId !== 'temp') {
              try {
                await updateDoc(doc(db, 'partners', partnerId), {
                  logo_url: downloadURL,
                  logo_updated_at: serverTimestamp()
                });
              } catch (fsErr) {
                console.error('Firestore write-back failed:', fsErr);
              }
            }

            // Success state
            setPreviewUrl(downloadURL);
            onLogoUploaded(downloadURL);
            setProgress(null);
            setIsProcessing(false);
            uploadTaskRef.current = null;
          } catch (err) {
            console.error('URL error:', err);
            setError('FAILED_TO_GET_URL');
            setProgress(null);
            setIsProcessing(false);
            uploadTaskRef.current = null;
          }
        }
      );
    } catch (err) {
      console.error('Compression/Upload error:', err);
      setError('PROCESSING_FAILED');
      setProgress(null);
      setIsProcessing(false);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onLogoUploaded('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
      uploadTaskRef.current = null;
    }
    setProgress(null);
    setIsProcessing(false);
    setError(null);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lastFile) {
      startUpload(lastFile);
    } else {
      fileInputRef.current?.click();
    }
  };

  const compressImage = (file: File): Promise<Blob | File> => {
    if (file.type === 'image/svg+xml') return Promise.resolve(file);

    return new Promise((resolve) => {
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

  const displayUrl = previewUrl || currentLogoUrl;

  return (
    <div className="flex flex-col gap-3">
      <div 
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative group w-32 h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
          error ? 'border-hud-magenta bg-hud-magenta/5' : 'border-white/20 hover:border-hud-yellow bg-white/5'
        } ${isProcessing ? 'cursor-wait opacity-80' : ''}`}
      >
        {displayUrl ? (
          <img 
            src={displayUrl} 
            alt="Partner Logo" 
            className={`w-full h-full object-contain p-2 transition-opacity duration-300 ${isProcessing ? 'opacity-20' : 'opacity-100'}`}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/40">
            <ImageIcon size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Upload Logo</span>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center p-4">
            {progress === 0 ? (
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

        {displayUrl && !isProcessing && (
          <button 
            onClick={handleRemove}
            className="absolute top-1 right-1 p-1 bg-hud-magenta text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {error && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-hud-magenta text-[10px] font-bold uppercase">
            <AlertCircle size={12} />
            {error}
          </div>
          <button 
            onClick={handleRetry}
            className="flex items-center gap-1 text-hud-yellow text-[9px] font-bold uppercase hover:underline"
          >
            <RotateCcw size={10} />
            Retry Upload
          </button>
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
        accept=".png,.jpg,.jpeg,.svg,.webp"
      />
      
      <p className="text-[9px] opacity-40 uppercase tracking-wider">
        PNG, JPG, SVG, WEBP // MAX 5MB
      </p>
    </div>
  );
};
