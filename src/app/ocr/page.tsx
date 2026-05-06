"use client";

import { useState } from "react";
import ScannerOCR from "@/components/ScannerOCR";
import ResultsDashboard from "@/components/ResultsDashboard";
import { Leaf, ScanLine, ShieldCheck, Cpu } from "lucide-react";

/**
 * /ocr — Standalone page that uses the local EasyOCR pipeline.
 *
 * Mirrors the main page's layout but uses ScannerOCR (with crop step)
 * and hits /api/analyze-image-ocr instead of the Gemini-powered route.
 * Existing files are untouched — this is a parallel module.
 */
export default function OcrPage() {
  const [analysisData, setAnalysisData] = useState<{ productType: string; ingredients: string[] } | null>(null);

  return (
    <main className="min-h-screen bg-[#050A07] text-slate-100 selection:bg-emerald-900 selection:text-emerald-100 relative overflow-hidden">

      {/* Background ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
        <div
          className="absolute -top-[25%] -left-[15%] w-[55%] h-[55%] rounded-full"
          style={{ background: "radial-gradient(ellipse at center, rgba(0,185,90,0.12) 0%, transparent 70%)", animation: "float-slow 14s ease-in-out infinite" }}
        />
        <div
          className="absolute top-[30%] -right-[20%] w-[60%] h-[60%] rounded-full"
          style={{ background: "radial-gradient(ellipse at center, rgba(0,100,180,0.08) 0%, transparent 70%)", animation: "float-medium 18s ease-in-out infinite" }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        />
      </div>

      <div className="container mx-auto px-4 py-12 md:py-20 relative z-10 flex flex-col items-center justify-start min-h-screen">

        {/* Hero */}
        {!analysisData && (
          <div className="text-center mb-12 md:mb-16 space-y-7 animate-in fade-in slide-in-from-bottom-6 duration-700 max-w-2xl mx-auto pt-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 text-emerald-400 text-xs font-semibold tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Local OCR Mode
            </div>

            <h1 className="text-5xl md:text-[4.25rem] font-black tracking-tight leading-[1.08] font-[family-name:var(--font-inter-tight)]">
              Scan.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-green-300 to-teal-400">
                Crop.
              </span>{" "}
              Know.
            </h1>

            <p className="text-lg md:text-xl text-slate-400 leading-relaxed max-w-lg mx-auto">
              Capture a photo, crop to the ingredients area, and let EasyOCR extract every ingredient — no API key needed.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 pt-2">
              {[
                { icon: Cpu, label: "Runs locally via EasyOCR" },
                { icon: ScanLine, label: "Crop-to-scan precision" },
                { icon: ShieldCheck, label: "Evidence-based ratings" },
                { icon: Leaf, label: "Food · Beauty · Supplements" },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                  <Icon className="w-3.5 h-3.5 text-emerald-600" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic content */}
        <div className="w-full transition-all duration-700 ease-in-out relative z-20">
          {!analysisData ? (
            <ScannerOCR onAnalyzeComplete={setAnalysisData} />
          ) : (
            <ResultsDashboard
              initialData={analysisData}
              onReset={() => setAnalysisData(null)}
            />
          )}
        </div>

        {!analysisData && (
          <div className="mt-16 text-center animate-in fade-in duration-700 delay-500 space-y-2">
            <p className="text-xs text-slate-600">
              For informational purposes only. Not a substitute for medical advice.
            </p>
            <a
              href="/"
              className="text-xs text-emerald-700 hover:text-emerald-500 transition-colors font-medium"
            >
              Switch to Gemini AI scanner →
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
