"use client";

import { useState } from "react";
import Scanner from "@/components/Scanner";
import ResultsDashboard from "@/components/ResultsDashboard";
import { Sparkles } from "lucide-react";

export default function Home() {
  const [analysisData, setAnalysisData] = useState<{ productType: string; ingredients: string[] } | null>(null);

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-white text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.015] mix-blend-overlay pointer-events-none"></div>
      
      <div className="container mx-auto px-4 py-16 relative z-10 flex flex-col items-center justify-center min-h-screen">
        
        {/* Header */}
        <div className="text-center mb-16 space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            AI-Powered Analysis
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900">
            Know What's <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Inside.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto">
            Scan your product labels instantly to extract ingredients, classify product types, and reveal the health impacts you deserve to know.
          </p>
        </div>

        {/* Dynamic Content */}
        <div className="w-full transition-all duration-500 ease-in-out">
          {!analysisData ? (
            <Scanner onAnalyzeComplete={setAnalysisData} />
          ) : (
            <ResultsDashboard 
              initialData={analysisData} 
              onReset={() => setAnalysisData(null)} 
            />
          )}
        </div>

      </div>
    </main>
  );
}
