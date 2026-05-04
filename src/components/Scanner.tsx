"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, Sparkles, Image as ImageIcon, X, Aperture } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannerProps {
  onAnalyzeComplete: (data: { productType: string; ingredients: string[] }) => void;
}

export default function Scanner({ onAnalyzeComplete }: ScannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia not supported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn("Camera error, falling back to native input:", err);
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      } else {
        setError("Could not access camera. Please allow camera permissions or use file upload.");
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
          stopCamera();
          processFile(file);
        }
      }, "image/jpeg", 0.9);
    }
  };

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
        let errorMsg = "Failed to analyze image. Please ensure it's a clear photo of ingredients.";
        try {
          const errData = await response.json();
          if (errData.details) errorMsg += ` (${errData.details})`;
          else if (errData.error) errorMsg += ` (${errData.error})`;
        } catch(e) {}
        throw new Error(errorMsg);
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
      {/* Hidden Canvas for Camera Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Interaction Area */}
      <div 
        onDragOver={!isCameraActive && !loading ? handleDragOver : undefined}
        onDragLeave={!isCameraActive && !loading ? handleDragLeave : undefined}
        onDrop={!isCameraActive && !loading ? handleDrop : undefined}
        className={`relative overflow-hidden group bg-white/5 backdrop-blur-3xl p-10 rounded-[2rem] border-2 transition-all duration-500 ease-out shadow-[0_8px_40px_rgb(0,0,0,0.08)] hover:shadow-[0_20px_60px_rgb(0,0,0,0.12)]
          ${isDragging ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' : 'border-white/10'}
        `}
      >
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        
        {loading && previewImage ? (
          // Scanning State
          <div className="absolute inset-0 z-10 bg-[#0B0B0B]/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-2xl mb-6 border border-slate-200">
              <img src={previewImage} alt="Scanning" className="w-full h-full object-cover" />
              {/* Laser Animation */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
            </div>
            <div className="flex items-center gap-3 text-indigo-400 font-semibold text-lg">
              <Sparkles className="w-5 h-5 animate-pulse text-indigo-400" />
              <span className="animate-pulse">AI is reading the label...</span>
            </div>
          </div>
        ) : isCameraActive ? (
          // Live Camera State
          <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 duration-300">
            <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-inner mb-6 border border-slate-200">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <Button 
                variant="destructive" 
                size="icon" 
                className="absolute top-3 right-3 rounded-full opacity-80 hover:opacity-100 shadow-md"
                onClick={stopCamera}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <Button 
              onClick={capturePhoto}
              className="rounded-full px-8 h-14 text-base font-bold shadow-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all hover:scale-105 active:scale-95"
            >
              <Aperture className="mr-2 h-6 w-6" /> Take Photo
            </Button>
          </div>
        ) : (
          // Default State (Upload or Start Camera)
          <div className="relative z-10 text-center space-y-6 py-4">
            <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-indigo-100 to-white rounded-3xl flex items-center justify-center text-indigo-600 shadow-[inset_0_2px_10px_rgb(0,0,0,0.05)] transform group-hover:scale-110 transition-transform duration-500">
              <Camera size={40} className="group-hover:text-indigo-500 transition-colors" />
            </div>
            
            <div>
              <h2 className="text-3xl font-bold text-white font-[family-name:var(--font-inter-tight)] tracking-tight">Scan Ingredients</h2>
              <p className="text-slate-400 mt-2 text-base max-w-xs mx-auto">
                Use your camera, snap a photo, or drop an image of a product label.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
              <Button 
                onClick={startCamera}
                className="w-full sm:w-auto rounded-full px-8 h-12 text-base font-semibold shadow-lg shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white transition-all hover:-translate-y-0.5"
              >
                <Camera className="mr-2 h-5 w-5" /> Use Camera
              </Button>
              <div className="text-slate-500 text-sm font-medium">OR</div>
              <Button 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto rounded-full px-8 h-12 text-base font-semibold shadow-sm bg-white/5 border-white/10 hover:bg-white/10 text-white transition-all hover:-translate-y-0.5"
              >
                <Upload className="mr-2 h-5 w-5" /> Browse Files
              </Button>
            </div>
          </div>
        )}
        
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
        <input
          type="file"
          ref={cameraInputRef}
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
