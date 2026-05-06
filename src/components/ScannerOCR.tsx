"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
  Camera, Upload, Sparkles, AlertCircle, X, Aperture, ScanLine,
  Crop, Check, RotateCcw, ZoomIn, ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCroppedImageBlob, type PixelCrop } from "@/utils/cropImage";

interface ScannerOCRProps {
  onAnalyzeComplete: (data: { productType: string; ingredients: string[] }) => void;
}

type Phase = "idle" | "camera" | "crop" | "analyzing";

export default function ScannerOCR({ onAnalyzeComplete }: ScannerOCRProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  // Image for cropping
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  // Crop state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);

  // Drag-and-drop
  const [isDragging, setIsDragging] = useState(false);

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /* ── Camera helpers ─────────────────────────────────────────────────── */

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia not supported");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPhase("camera");
    } catch {
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
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    enterCropMode(dataUrl);
  };

  /* ── Image selection → crop mode ────────────────────────────────────── */

  const enterCropMode = (src: string) => {
    setImageSrc(src);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPhase("crop");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => enterCropMode(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  /* ── Submit cropped image ───────────────────────────────────────────── */

  const handleDone = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setPhase("analyzing");
    setError(null);

    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append("image", blob, "cropped-ingredients.jpg");

      const response = await fetch("/api/analyze-image-ocr", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let msg = "Failed to extract ingredients.";
        try {
          const errData = await response.json();
          if (errData.details) msg += ` ${errData.details}`;
          else if (errData.error) msg += ` ${errData.error}`;
        } catch {}
        throw new Error(msg);
      }

      onAnalyzeComplete(await response.json());
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis.");
      setPhase("crop"); // stay in crop mode so user can retry
    }
  };

  /* ── Reset ──────────────────────────────────────────────────────────── */

  const handleReset = () => {
    stopCamera();
    setImageSrc(null);
    setCroppedAreaPixels(null);
    setError(null);
    setPhase("idle");
  };

  /* ── Drag and drop ──────────────────────────────────────────────────── */

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => enterCropMode(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setError("Please drop a valid image file.");
    }
  }, []);

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="w-full max-w-xl mx-auto">
      <canvas ref={canvasRef} className="hidden" />

      {/* ── CROP PHASE ─────────────────────────────────────────────────── */}
      {phase === "crop" && imageSrc && (
        <div className="rounded-[1.75rem] border border-white/8 bg-[#0D1610] overflow-hidden"
          style={{ boxShadow: "0 8px 60px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset" }}>

          {/* Crop header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Crop className="w-4 h-4 text-emerald-400" />
              Select the ingredients area
            </div>
            <button onClick={handleReset} className="text-slate-500 hover:text-slate-300 transition-colors" aria-label="Cancel">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cropper area */}
          <div className="relative w-full" style={{ height: "420px" }}>
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              cropShape="rect"
              showGrid
              style={{
                containerStyle: { background: "#050A07" },
                cropAreaStyle: { border: "2px solid rgba(0,220,130,0.7)", borderRadius: "12px" },
              }}
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center justify-center gap-4 px-5 py-2 border-t border-white/8">
            <button
              onClick={() => setZoom(z => Math.max(1, z - 0.2))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-32 h-1 rounded-full appearance-none bg-white/10 accent-emerald-500"
              aria-label="Zoom level"
            />
            <button
              onClick={() => setZoom(z => Math.min(4, z + 0.2))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-white/8">
            <Button
              variant="ghost"
              onClick={handleReset}
              className="text-slate-400 hover:text-white hover:bg-white/6 rounded-full text-sm"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Retake
            </Button>
            <Button
              onClick={handleDone}
              className="rounded-full px-8 h-11 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-[#050A07] transition-all hover:scale-105 active:scale-95 shadow-[0_4px_24px_rgba(0,220,130,0.35)]"
            >
              <Check className="mr-2 h-4 w-4" />
              Done — Scan
            </Button>
          </div>
        </div>
      )}

      {/* ── ANALYZING PHASE ─────────────────────────────────────────────── */}
      {phase === "analyzing" && imageSrc && (
        <div
          className="rounded-[1.75rem] border border-white/8 bg-[#0D1610] p-10 flex flex-col items-center justify-center gap-6 min-h-[340px]"
          style={{ boxShadow: "0 8px 60px rgba(0,0,0,0.35)" }}
        >
          <div className="relative w-52 h-44 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <img src={imageSrc} alt="Scanning" className="w-full h-full object-cover" />
            <div
              className="absolute left-0 w-full h-[2px] pointer-events-none"
              style={{
                background: "linear-gradient(90deg, transparent 0%, #00DC82 30%, #00DC82 70%, transparent 100%)",
                boxShadow: "0 0 14px rgba(0,220,130,0.9)",
                animation: "scan 2s ease-in-out infinite",
              }}
            />
            <div className="absolute inset-0 bg-[#050A07]/40" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-base">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="animate-pulse">Reading ingredients…</span>
            </div>
            <p className="text-xs text-slate-600 text-center max-w-[240px]">
              EasyOCR is extracting text from the cropped area
            </p>
          </div>
        </div>
      )}

      {/* ── CAMERA PHASE ────────────────────────────────────────────────── */}
      {phase === "camera" && (
        <div
          className="rounded-[1.75rem] border border-white/8 bg-[#0D1610] p-5 flex flex-col items-center gap-5"
          style={{ boxShadow: "0 8px 60px rgba(0,0,0,0.35)" }}
        >
          <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-white/8">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            {/* Corner brackets */}
            {["top-2 left-2 border-t-2 border-l-2", "top-2 right-2 border-t-2 border-r-2",
              "bottom-2 left-2 border-b-2 border-l-2", "bottom-2 right-2 border-b-2 border-r-2"].map((cls, i) => (
              <div key={i} className={`absolute w-5 h-5 border-emerald-400/70 rounded-sm ${cls}`} />
            ))}
            <Button
              variant="destructive" size="icon"
              className="absolute top-3 right-3 rounded-full w-8 h-8 bg-black/60 hover:bg-red-600 border border-white/10"
              onClick={() => { stopCamera(); setPhase("idle"); }}
              aria-label="Stop camera"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-xs text-slate-500 text-center">Position the ingredients label in the frame, then capture</p>
          <Button
            onClick={capturePhoto}
            className="rounded-full px-10 h-13 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-[#050A07] transition-all hover:scale-105 active:scale-95 shadow-[0_4px_24px_rgba(0,220,130,0.35)]"
          >
            <Aperture className="mr-2 h-5 w-5" />
            Capture
          </Button>
        </div>
      )}

      {/* ── IDLE PHASE ──────────────────────────────────────────────────── */}
      {phase === "idle" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            "rounded-[1.75rem] border transition-all duration-400",
            isDragging
              ? "border-emerald-400/60 bg-emerald-500/10 scale-[1.015] shadow-[0_0_60px_rgba(0,220,130,0.15)]"
              : "border-white/8 bg-[#0D1610]",
          ].join(" ")}
          style={{ boxShadow: isDragging ? undefined : "0 8px 60px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset" }}
        >
          {/* Gradient sheen */}
          <div
            className="absolute top-0 left-0 right-0 h-px opacity-30 pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, rgba(0,220,130,0.6), transparent)" }}
            aria-hidden
          />

          <div className="p-10 text-center space-y-7 relative">
            <div
              className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(0,220,130,0.12) 0%, rgba(0,180,100,0.06) 100%)", border: "1px solid rgba(0,220,130,0.18)" }}
            >
              <ScanLine size={34} className="text-emerald-400" strokeWidth={1.5} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white font-[family-name:var(--font-inter-tight)] tracking-tight">
                {isDragging ? "Drop to scan" : "Scan Ingredients"}
              </h2>
              <p className="text-slate-500 mt-1.5 text-sm max-w-[280px] mx-auto leading-relaxed">
                Take a photo and crop to the ingredients area — no cloud AI needed.
              </p>
            </div>

            {/* OCR badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(0,220,130,0.08)", border: "1px solid rgba(0,220,130,0.18)", color: "#00D97E" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Local OCR — no API key required
            </div>

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

            <p className="text-[11px] text-slate-700 font-medium">
              or drag &amp; drop an image anywhere on this card
            </p>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />

      {/* Error banner */}
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
