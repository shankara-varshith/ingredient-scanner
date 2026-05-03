"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Upload, Sparkles, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannerProps {
  onAnalyzeComplete: (data: { productType: string; ingredients: string[] }) => void;
}

export default function Scanner({ onAnalyzeComplete }: ScannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setLoading(true);
    setError(null);
    
    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewImage(objectUrl);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to analyze image. Please ensure it's a clear photo of ingredients.");
      }

      const data = await response.json();
      onAnalyzeComplete(data);
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis");
      setPreviewImage(null);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processFile(file);
    } else {
      setError("Please drop a valid image file.");
    }
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Dropzone Area */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !loading && fileInputRef.current?.click()}
        className={`relative overflow-hidden group cursor-pointer bg-white/40 backdrop-blur-3xl p-10 rounded-[2rem] border-2 transition-all duration-500 ease-out shadow-[0_8px_40px_rgb(0,0,0,0.08)] hover:shadow-[0_20px_60px_rgb(0,0,0,0.12)]
          ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-white/60 hover:border-indigo-300/50'}
          ${loading ? 'pointer-events-none' : ''}
        `}
      >
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        
        {loading && previewImage ? (
          // Scanning State
          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-2xl mb-6">
              <img src={previewImage} alt="Scanning" className="w-full h-full object-cover" />
              {/* Laser Animation */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
            </div>
            <div className="flex items-center gap-3 text-indigo-700 font-semibold text-lg">
              <Sparkles className="w-5 h-5 animate-pulse text-indigo-500" />
              <span className="animate-pulse">AI is reading the label...</span>
            </div>
          </div>
        ) : (
          // Default State
          <div className="relative z-10 text-center space-y-6">
            <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-indigo-100 to-white rounded-3xl flex items-center justify-center text-indigo-600 shadow-[inset_0_2px_10px_rgb(0,0,0,0.05)] transform group-hover:scale-110 transition-transform duration-500">
              <Camera size={40} className="group-hover:text-indigo-500 transition-colors" />
            </div>
            
            <div>
              <h2 className="text-3xl font-bold text-slate-800 font-[family-name:var(--font-outfit)] tracking-tight">Scan Ingredients</h2>
              <p className="text-slate-500 mt-2 text-base max-w-xs mx-auto">
                Snap a photo or drag & drop an image of a product label to analyze it.
              </p>
            </div>

            <Button 
              className="mt-4 rounded-full px-8 h-12 text-base font-semibold shadow-lg shadow-indigo-500/20 bg-slate-900 hover:bg-slate-800 text-white transition-all hover:scale-105"
            >
              <Upload className="mr-2 h-5 w-5" /> Browse Files
            </Button>
          </div>
        )}
        
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
        />
      </div>
      
      {error && (
        <div className="mt-6 p-4 bg-red-50/80 backdrop-blur-md text-red-600 rounded-2xl text-sm border border-red-100 flex items-center gap-3 shadow-sm animate-in slide-in-from-bottom-2">
          <div className="w-8 h-8 bg-red-100 rounded-full flex flex-shrink-0 items-center justify-center">
            <ImageIcon className="w-4 h-4 text-red-500" />
          </div>
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Global CSS for the scanning laser animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}} />
    </div>
  );
}
