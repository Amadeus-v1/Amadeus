'use client';

import { useState } from 'react';
import { Camera, Upload, Disc, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  onScanResult: (data: any) => void;
}

export default function ImageUpload({ onScanResult }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    // Simulate API call to AI Recognition Service
    // In production, use: const formData = new FormData(); formData.append('image', file);
    // await api.post('/media/recognize-cover', formData);

    setTimeout(() => {
      onScanResult({
        title: "Unknown Record",
        creator: "Unknown Artist",
        confidence: 0.85,
        isCustom: true
      });
      setIsUploading(false);
    }, 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Loader2 className="w-8 h-8 mb-4 text-amadeus-500 animate-spin" />
              <p className="text-sm text-gray-500">AI is identifying cover...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Camera className="w-8 h-8 mb-4 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500 font-bold">Upload cover photo</p>
              <p className="text-xs text-gray-400 uppercase tracking-widest">Tap to capture or browse</p>
            </div>
          )}
          <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
        </label>
      </div>
    </div>
  );
}
