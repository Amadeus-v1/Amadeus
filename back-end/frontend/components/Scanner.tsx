'use client';

import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

interface ScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export default function Scanner({ onScan, onClose }: ScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 150 } },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        onScan(decodedText);
        if (scannerRef.current) {
          scannerRef.current.clear();
        }
      },
      (error) => {
        // Handle scan error (usually just "no QR code in frame")
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black">
      <div className="absolute top-4 right-4 z-[70]">
        <button 
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      
      <div className="w-full max-w-md px-4 text-center mb-8">
        <h2 className="text-xl font-bold text-white mb-2">Scan Barcode</h2>
        <p className="text-gray-400 text-sm">Position the barcode within the frame</p>
      </div>

      <div id="reader" className="w-full max-w-md overflow-hidden rounded-xl bg-white/5 border border-white/10"></div>
      
      <div className="mt-8">
        <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Supports EAN, UPC, and QR</p>
      </div>
    </div>
  );
}
