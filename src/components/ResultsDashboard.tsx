"use client";

import { useState, useEffect } from "react";
import { Loader2, ArrowLeft, Edit2, Check, AlertTriangle, ShieldCheck, HeartPulse, Brain, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";

interface ResultsDashboardProps {
  initialData: { productType: string; ingredients: string[] };
  onReset: () => void;
}

export default function ResultsDashboard({ initialData, onReset }: ResultsDashboardProps) {
  const [productType, setProductType] = useState(initialData.productType);
  const [isEditingType, setIsEditingType] = useState(false);
  const [tempType, setTempType] = useState(initialData.productType);
  
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIngredientsData();
  }, []);

  const fetchIngredientsData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: initialData.ingredients }),
      });
      if (!res.ok) throw new Error("Failed to fetch ingredient data");
      const data = await res.json();
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveType = () => {
    setProductType(tempType);
    setIsEditingType(false);
  };

  // Helper to pick an icon based on category name
  const getCategoryIcon = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('immun') || c.includes('protect')) return <ShieldCheck className="w-4 h-4 mr-2 text-emerald-600" />;
    if (c.includes('heart') || c.includes('cardio')) return <HeartPulse className="w-4 h-4 mr-2 text-rose-500" />;
    if (c.includes('brain') || c.includes('cognit')) return <Brain className="w-4 h-4 mr-2 text-indigo-500" />;
    return <Zap className="w-4 h-4 mr-2 text-amber-500" />;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onReset} className="text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded-full px-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Scan Another Label
        </Button>
      </div>

      {/* Hero Stats Card */}
      <Card className="bg-white/60 backdrop-blur-2xl border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden rounded-[2rem]">
        <CardContent className="p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 w-full sm:w-auto">
            <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase font-[family-name:var(--font-outfit)]">Product Type</p>
            {isEditingType ? (
              <div className="flex items-center gap-3">
                <select
                  value={tempType}
                  onChange={(e) => setTempType(e.target.value)}
                  className="bg-white/80 border-2 border-indigo-100 rounded-xl px-4 py-2 text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                >
                  <option value="Food">Food</option>
                  <option value="Beauty/Cosmetics">Beauty/Cosmetics</option>
                  <option value="Supplement">Supplement</option>
                  <option value="Other">Other</option>
                </select>
                <Button size="icon" onClick={handleSaveType} className="rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30">
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 group">
                <h2 className="text-3xl font-extrabold text-slate-800 bg-clip-text text-transparent bg-gradient-to-br from-slate-800 to-slate-500 font-[family-name:var(--font-outfit)] tracking-tight">
                  {productType}
                </h2>
                <Button size="icon" variant="ghost" onClick={() => setIsEditingType(true)} className="rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all">
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex gap-8">
            <div className="text-center sm:text-right">
              <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase font-[family-name:var(--font-outfit)]">Extracted</p>
              <p className="text-4xl font-black text-slate-800">{initialData.ingredients.length}</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase font-[family-name:var(--font-outfit)]">Matched</p>
              <p className="text-4xl font-black text-indigo-600">{results.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-[2rem] bg-white/40" />
          <Skeleton className="h-32 w-full rounded-[2rem] bg-white/40" />
          <Skeleton className="h-32 w-full rounded-[2rem] bg-white/40" />
        </div>
      ) : error ? (
        <Card className="bg-red-50/50 border-red-100 rounded-[2rem]">
          <CardContent className="p-12 text-center text-red-500 flex flex-col items-center">
            <AlertTriangle className="h-16 w-16 mb-6 text-red-400 drop-shadow-sm" />
            <p className="text-lg font-medium">{error}</p>
            <Button variant="outline" onClick={fetchIngredientsData} className="mt-6 rounded-full border-red-200 hover:bg-red-50 text-red-600">
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card className="bg-white/50 backdrop-blur-xl border-dashed border-2 border-slate-200 rounded-[2rem]">
          <CardContent className="p-16 text-center text-slate-500">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">No Detailed Records Found</h3>
            <p className="text-base max-w-md mx-auto">We couldn't find detailed health data for these specific ingredients in our database yet.</p>
            <div className="mt-8 flex flex-wrap gap-2 justify-center">
              {initialData.ingredients.map((ing, i) => (
                <Badge key={i} variant="secondary" className="bg-white text-slate-600 font-normal px-3 py-1 text-sm border-slate-200">
                  {ing}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {results.map((item) => (
            <Card key={item._id} className="bg-white/70 backdrop-blur-xl border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-[2rem] overflow-hidden group">
              <div className="p-8">
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                  {/* Left Column: Name & Description */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold text-slate-900 font-[family-name:var(--font-outfit)] tracking-tight">{item.name}</h3>
                      {item.rda && <Badge variant="outline" className="bg-indigo-50/50 text-indigo-700 border-indigo-100 font-semibold">RDA: {item.rda.adult}</Badge>}
                    </div>
                    <p className="text-slate-600 leading-relaxed text-base">
                      {item.description}
                    </p>
                  </div>
                  
                  {/* Right Column: Key Benefits */}
                  <div className="flex-1 bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100/50">
                    <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-4 flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-2" /> Top Benefits
                    </h4>
                    <ul className="space-y-3">
                      {item.benefits.slice(0, 3).map((b: any, i: number) => (
                        <li key={i} className="flex items-start">
                          {getCategoryIcon(b.category)}
                          <div>
                            <span className="font-semibold text-slate-800 block text-sm">{b.category}</span>
                            <span className="text-slate-600 text-sm leading-tight block mt-0.5">{b.description}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Bottom Section: Expandable Risks/Sources */}
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <Accordion className="w-full">
                    <AccordionItem value="details" className="border-none">
                      <AccordionTrigger className="hover:no-underline py-2 text-slate-500 hover:text-indigo-600 font-medium">
                        View Sources & Risk Factors
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-2">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Natural Sources</h4>
                            <div className="flex flex-wrap gap-2">
                              {item.sources.map((src: string, i: number) => (
                                <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1 rounded-lg">
                                  {src}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Health Risks</h4>
                            <div className="space-y-3">
                              {item.risksAndDeficiency?.excess && (
                                <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                                  <p className="text-rose-800 text-sm"><span className="font-bold block mb-1">Excess Risk:</span> {item.risksAndDeficiency.excess}</p>
                                </div>
                              )}
                              {item.risksAndDeficiency?.deficiency && (
                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                  <p className="text-amber-800 text-sm"><span className="font-bold block mb-1">Deficiency Risk:</span> {item.risksAndDeficiency.deficiency}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
