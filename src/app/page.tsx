"use client";

import { useState } from "react";
import Scanner from "@/components/Scanner";
import ResultsDashboard from "@/components/ResultsDashboard";
import { Leaf, ScanLine, ShieldCheck, Zap } from "lucide-react";

export default function Home() {
  const [analysisData, setAnalysisData] = useState<{ productType: string; ingredients: string[] } | null>(null);

  return (
    <main className="min-h-screen bg-[#050A07] text-slate-100 selection:bg-emerald-900 selection:text-emerald-100 relative overflow-hidden">

      {/* ── Background ambient blobs ─────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
        <div
          className="absolute -top-[25%] -left-[15%] w-[55%] h-[55%] rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,185,90,0.12) 0%, transparent 70%)",
            animation: "float-slow 14s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-[30%] -right-[20%] w-[60%] h-[60%] rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,100,180,0.08) 0%, transparent 70%)",
            animation: "float-medium 18s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -bottom-[20%] left-[15%] w-[55%] h-[55%] rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,200,120,0.07) 0%, transparent 70%)",
            animation: "float-slow 20s ease-in-out infinite reverse",
          }}
        />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="container mx-auto px-4 py-12 md:py-20 relative z-10 flex flex-col items-center justify-start min-h-screen">

        {/* ── Hero ─────────────────────────────────────────────── */}
        {!analysisData && (
          <div className="text-center mb-12 md:mb-16 space-y-7 animate-in fade-in slide-in-from-bottom-6 duration-700 max-w-2xl mx-auto pt-6">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 text-emerald-400 text-xs font-semibold tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI-Powered Health Analysis
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-[4.25rem] font-black tracking-tight leading-[1.08] font-[family-name:var(--font-inter-tight)]">
              Know What's{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-green-300 to-teal-400">
                  Really Inside.
                </span>
                {/* Underline glow */}
                <span
                  className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full opacity-60"
                  style={{ background: "linear-gradient(90deg, #34d399, #2dd4bf)" }}
                  aria-hidden
                />
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-lg md:text-xl text-slate-400 leading-relaxed max-w-lg mx-auto">
              Scan any product label — food, cosmetics, supplements — and instantly uncover every ingredient's health impact.
            </p>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 pt-2">
              {[
                { icon: ScanLine, label: "Instant OCR extraction" },
                { icon: ShieldCheck, label: "Evidence-based ratings" },
                { icon: Leaf, label: "Food · Beauty · Supplements" },
                { icon: Zap, label: "Powered by Gemini AI" },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                  <Icon className="w-3.5 h-3.5 text-emerald-600" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Dynamic content area ─────────────────────────────── */}
        <div className="w-full transition-all duration-700 ease-in-out relative z-20">
          {!analysisData ? (
            <Scanner onAnalyzeComplete={setAnalysisData} />
          ) : (
            <ResultsDashboard
              initialData={analysisData}
              onReset={() => setAnalysisData(null)}
            />
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        {!analysisData && (
          <p className="mt-16 text-xs text-slate-600 text-center animate-in fade-in duration-700 delay-500">
            For informational purposes only. Not a substitute for medical advice.
          </p>
        )}
      </div>
    </main>
  );
}
