"use client";

import { useState } from "react";
import Scanner from "@/components/Scanner";
import ResultsDashboard from "@/components/ResultsDashboard";
import { Sparkles, ArrowRight } from "lucide-react";

export default function Home() {
  const [analysisData, setAnalysisData] = useState<{ productType: string; ingredients: string[] } | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 relative overflow-hidden">
      {/* Background Mesh/Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-200/40 blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-violet-200/40 blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '12s' }}></div>
        <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-blue-200/40 blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '10s' }}></div>
      </div>
      
      {/* Noise Overlay */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.015] mix-blend-overlay pointer-events-none z-0"></div>
      
      <div className="container mx-auto px-4 py-12 md:py-24 relative z-10 flex flex-col items-center justify-start min-h-screen">
        
        {/* Header */}
        <div className="text-center mb-12 md:mb-20 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-3xl mx-auto pt-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 backdrop-blur-md border border-indigo-100 shadow-sm text-indigo-700 text-sm font-semibold mb-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            AI-Powered Health Analysis
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 font-[family-name:var(--font-outfit)] leading-[1.1]">
            Know What's <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 drop-shadow-sm">Really Inside.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 font-medium leading-relaxed">
            Scan your product labels instantly to extract ingredients, classify product types, and reveal the hidden health impacts you deserve to know.
          </p>
        </div>

        {/* Dynamic Content */}
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
        
        {/* Footer Area */}
        {!analysisData && (
          <div className="mt-20 text-center animate-in fade-in duration-1000 delay-500">
            <p className="text-sm font-medium text-slate-400 flex items-center justify-center gap-2">
              Powered by Gemini AI <ArrowRight className="w-4 h-4" />
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
