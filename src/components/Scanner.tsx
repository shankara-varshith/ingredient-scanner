"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, Sparkles, AlertCircle, X, Aperture, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannerProps {
  onAnalyzeComplete: (data: { productType: string; ingredients: string[] }) => void;
}

export default function Scanner({ onAnalyzeComplete }: ScannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia not supported");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraActive(true);
    } catch (err) {
      if (cameraInputRef.current) cameraInputRef.current.click();
      else setError("Could not access camera. Please allow permissions or use file upload.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          stopCamera();
          processFile(new File([blob], "camera-capture.jpg", { type: "image/jpeg" }));
        }
      }, "image/jpeg", 0.9);
    }
  };

  const processFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setPreviewImage(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append("image", file);
    try {
      const response = await fetch("/api/analyze-image", { method: "POST", body: formData });
      if (!response.ok) {
        let msg = "Failed to analyze image. Please use a clear photo of the ingredients list.";
        try {
          const e = await response.json();
          if (e.details) msg += ` (${e.details})`;
          else if (e.error) msg += ` (${e.error})`;
        } catch {}
        throw new Error(msg);
      }
      onAnalyzeComplete(await response.json());
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis.");
      setPreviewImage(null);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) processFile(file);
    else setError("Please drop a valid image file.");
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto">
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Main card ────────────────────────────────────────── */}
      <div
        onDragOver={!isCameraActive && !loading ? handleDragOver : undefined}
        onDragLeave={!isCameraActive && !loading ? handleDragLeave : undefined}
        onDrop={!isCameraActive && !loading ? handleDrop : undefined}
        className={[
          "relative overflow-hidden rounded-[1.75rem] border transition-all duration-400",
          isDragging
            ? "border-emerald-400/60 bg-emerald-500/10 scale-[1.015] shadow-[0_0_60px_rgba(0,220,130,0.15)]"
            : "border-white/8 bg-[#0D1610]",
        ].join(" ")}
        style={{ boxShadow: isDragging ? undefined : "0 8px 60px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset" }}
      >
        {/* Gradient sheen on top edge */}
        <div
          className="absolute top-0 left-0 right-0 h-px opacity-30 pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, rgba(0,220,130,0.6), transparent)" }}
          aria-hidden
        />

        {/* ── Scanning / loading state ── */}
        {loading && previewImage ? (
          <div className="p-10 flex flex-col items-center justify-center gap-6 animate-in fade-in duration-300 min-h-[320px]">
            <div className="relative w-52 h-44 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex-shrink-0">
              <img src={previewImage} alt="Scanning" className="w-full h-full object-cover" />
              {/* Green laser line */}
              <div
                className="absolute left-0 w-full h-[2px] pointer-events-none"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, #00DC82 30%, #00DC82 70%, transparent 100%)",
                  boxShadow: "0 0 14px rgba(0,220,130,0.9)",
                  animation: "scan 2s ease-in-out infinite",
                }}
              />
              {/* Darkened overlay */}
              <div className="absolute inset-0 bg-[#050A07]/40" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-base">
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span className="animate-pulse">Reading the label…</span>
              </div>
              <p className="text-xs text-slate-600 text-center max-w-[220px]">Gemini AI is extracting and classifying every ingredient</p>
            </div>
          </div>
        ) : isCameraActive ? (

          /* ── Live camera ── */
          <div className="p-5 flex flex-col items-center gap-5 animate-in zoom-in-95 duration-300">
            <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-white/8">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {/* Corner brackets for camera framing cue */}
              {["top-2 left-2 border-t-2 border-l-2", "top-2 right-2 border-t-2 border-r-2",
                "bottom-2 left-2 border-b-2 border-l-2", "bottom-2 right-2 border-b-2 border-r-2"].map((cls, i) => (
                <div key={i} className={`absolute w-5 h-5 border-emerald-400/70 rounded-sm ${cls}`} />
              ))}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-3 right-3 rounded-full w-8 h-8 bg-black/60 hover:bg-red-600 border border-white/10"
                onClick={stopCamera}
                aria-label="Stop camera"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <Button
              onClick={capturePhoto}
              className="rounded-full px-10 h-13 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-[#050A07] transition-all hover:scale-105 active:scale-95 shadow-[0_4px_24px_rgba(0,220,130,0.35)]"
            >
              <Aperture className="mr-2 h-5 w-5" />
              Capture
            </Button>
          </div>

        ) : (

          /* ── Default upload state ── */
          <div className="p-10 text-center space-y-7">
            {/* Icon */}
            <div className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center relative"
              style={{ background: "linear-gradient(135deg, rgba(0,220,130,0.12) 0%, rgba(0,180,100,0.06) 100%)", border: "1px solid rgba(0,220,130,0.18)" }}>
              <ScanLine size={34} className="text-emerald-400" strokeWidth={1.5} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white font-[family-name:var(--font-inter-tight)] tracking-tight">
                {isDragging ? "Drop to scan" : "Scan Ingredients"}
              </h2>
              <p className="text-slate-500 mt-1.5 text-sm max-w-[260px] mx-auto leading-relaxed">
                Point your camera at the ingredients label, or upload a photo to get started.
              </p>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={startCamera}
                className="w-full sm:w-auto rounded-full px-7 h-11 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-[#050A07] transition-all hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(0,220,130,0.3)]"
              >
                <Camera className="mr-2 h-4 w-4" />
                Use Camera
              </Button>
              <span className="text-slate-600 text-xs font-medium hidden sm:block">or</span>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto rounded-full px-7 h-11 text-sm font-semibold border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-all hover:-translate-y-0.5"
              >
                <Upload className="mr-2 h-4 w-4" />
                Browse Files
              </Button>
            </div>

            {/* Drag hint */}
            <p className="text-[11px] text-slate-700 font-medium">
              or drag &amp; drop an image anywhere on this card
            </p>
          </div>
        )}

        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
      </div>

      {/* ── Error banner ─────────────────────────────────────── */}
      {error && (
        <div
          className="mt-5 px-4 py-3.5 rounded-2xl text-sm flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-200"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          role="alert"
        >
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 font-medium leading-snug">{error}</p>
        </div>
      )}
    </div>
  );
}
