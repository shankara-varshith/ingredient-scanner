"use client";

import { useState, useRef } from "react";
import { Camera, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannerProps {
  onAnalyzeComplete: (data: { productType: string; ingredients: string[] }) => void;
}

export default function Scanner({ onAnalyzeComplete }: ScannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to analyze image");
      }

      const data = await response.json();
      onAnalyzeComplete(data);
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis");
    } finally {
      setLoading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white/50 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 transition-all duration-300 hover:shadow-[0_8px_40px_rgb(0,0,0,0.16)]">
      <div className="text-center space-y-6">
        <div className="mx-auto w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600 shadow-inner">
          <Camera size={36} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Scan Ingredient Label</h2>
        <p className="text-slate-500 text-sm">
          Take a photo of the product label or upload an existing image to analyze its ingredients.
        </p>

        <div className="flex flex-col gap-4 mt-8">
          <Button 
            className="w-full rounded-xl h-14 text-base font-semibold shadow-md bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 transition-all"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing...</>
            ) : (
              <><Upload className="mr-2 h-5 w-5" /> Choose Image</>
            )}
          </Button>
          
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
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 animate-in fade-in slide-in-from-bottom-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
