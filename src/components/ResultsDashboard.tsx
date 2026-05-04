"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Check, Edit2, AlertCircle, ChevronDown, HeartPulse, ShieldAlert, AlertTriangle, Info, ChevronRight, Activity, Beaker, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultsDashboardProps {
  initialData: { productType: string; ingredients: string[] };
  onReset: () => void;
}

export default function ResultsDashboard({ initialData, onReset }: ResultsDashboardProps) {
  const [productType, setProductType] = useState(initialData.productType);
  const [isEditingType, setIsEditingType] = useState(false);
  const [tempType, setTempType] = useState(initialData.productType);
  
  const [loading, setLoading] = useState(true);
  const [matched, setMatched] = useState<any[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [extracted, setExtracted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"All" | "Risks" | "Benefits">("All");

  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  useEffect(() => {
    fetchIdentificationData();
  }, []);

  const fetchIdentificationData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scan/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted_ingredients: initialData.ingredients }),
      });
      if (!res.ok) throw new Error("Failed to identify ingredients");
      const data = await res.json();
      setExtracted(data.extracted_ingredients || []);
      setMatched(data.matched || []);
      setUnmatched(data.unmatched || []);
      
      // Auto-expand all by default or keep closed? Prompt says "Click on green chip -> auto-expand it". 
      // I'll keep them closed by default for uncluttered UI.
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

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToIngredient = (id: string) => {
    setOpenItems(prev => ({ ...prev, [id]: true }));
    setHighlightedRowId(id);
    setTimeout(() => {
      const el = document.getElementById(`ingredient-row-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    setTimeout(() => {
      setHighlightedRowId(null);
    }, 1600);
  };

  // KPI Calculations
  let criticalCount = 0;
  let warnCount = 0;
  let safeCount = 0;

  matched.forEach(ing => {
    const isCritical = (ing.risks || []).some((r: any) => r.severity_level === "high" || r.exceeds_safe) || ing.severity === "critical";
    const isWarn = !isCritical && ((ing.risks || []).some((r: any) => r.severity_level === "medium") || ing.severity === "warn");
    const isSafe = !isCritical && !isWarn && (
      ((ing.risks || []).every((r: any) => r.severity_level === "low") && (ing.benefits || []).length > 0) || 
      ing.severity === "ok" || ing.severity === "benefit"
    );

    if (isCritical) criticalCount++;
    else if (isWarn) warnCount++;
    else if (isSafe) safeCount++;
    else safeCount++; // fallback
  });

  const getSeverityDotColor = (severity: string) => {
    switch (severity) {
      case "critical": return "#E03A3E";
      case "warn": return "#E89B2C";
      case "benefit": return "#2F8F6E";
      case "ok":
      default: return "#3DAA5C";
    }
  };

  const getRiskColor = (severity_level: string) => {
    switch (severity_level) {
      case "high": return "#E03A3E";
      case "medium": return "#E89B2C";
      case "low":
      default: return "#3DAA5C";
    }
  };

  const renderGauge = (item: any, type: "risk" | "benefit") => {
    const list = type === "risk" ? item.risks : item.benefits;
    if (!list || list.length === 0) return null;

    return (
      <div className="space-y-6 mt-4">
        {list.map((data: any, idx: number) => {
          const maxVal = data.max || 100;
          const actualPct = Math.min((data.actual / maxVal) * 100, 100);
          const safePct = data.safe ? Math.min((data.safe / maxVal) * 100, 100) : 0;
          
          let rdaPct = 0;
          let hasRda = false;
          if (item.dosage?.rda) {
            hasRda = true;
            rdaPct = Math.min((item.dosage.rda / maxVal) * 100, 100);
          }

          const exceedsSafe = data.actual > data.safe;
          const fillColor = type === "risk" ? getRiskColor(data.severity_level) : "#2F8F6E";
          const finalFillColor = exceedsSafe && type === "risk" ? "#E03A3E" : fillColor;

          return (
            <div key={idx} className="flex flex-col space-y-2">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{data.label}</span>
                  {exceedsSafe && type === "risk" && <AlertTriangle className="w-4 h-4 text-[#E03A3E]" />}
                </div>
                <div className="text-xs text-slate-500">
                  {data.actual} {data.unit} &middot; safe limit {data.safe || '?'} {data.unit}
                </div>
              </div>

              <div className="relative h-2 bg-slate-200 rounded-full w-full" role="progressbar" aria-valuenow={data.actual} aria-valuemin={0} aria-valuemax={maxVal}>
                {/* Fill */}
                <div 
                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${actualPct}%`, backgroundColor: finalFillColor }}
                />

                {/* RDA Chevron */}
                {hasRda && (
                  <div 
                    className="absolute -top-3 w-3 h-3 text-slate-400 -translate-x-1/2 flex items-center justify-center cursor-help"
                    style={{ left: `${rdaPct}%` }}
                    title="Recommended daily allowance"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </div>
                )}

                {/* Safe Limit Line */}
                {data.safe && (
                  <div 
                    className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-slate-400 -translate-x-1/2"
                    style={{ left: `${safePct}%` }}
                  >
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 whitespace-nowrap">
                      safe limit
                    </div>
                  </div>
                )}
                
                {/* Max Label */}
                <div className="absolute -bottom-4 right-0 text-[10px] text-slate-400">max</div>
              </div>

              {/* Plain language context */}
              {data.context && (
                <div className="text-[13px] text-slate-600 leading-relaxed pt-3">
                  {data.context}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const filteredItems = matched.filter(item => {
    if (activeTab === "Risks") return item.risks && item.risks.length > 0;
    if (activeTab === "Benefits") return item.benefits && item.benefits.length > 0;
    return true;
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {isEditingType ? (
            <div className="flex items-center gap-2">
              <select
                value={tempType}
                onChange={(e) => setTempType(e.target.value)}
                className="bg-[#FAFAF7] border-2 border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              >
                <option value="Food">Food</option>
                <option value="Beauty/Cosmetics">Beauty/Cosmetics</option>
                <option value="Supplement">Supplement</option>
                <option value="Other">Other</option>
              </select>
              <Button size="icon" onClick={handleSaveType} className="rounded-lg h-9 w-9 bg-slate-800 hover:bg-slate-900">
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <Button variant="outline" className="bg-[#FAFAF7] rounded-xl shadow-sm border-slate-200 text-slate-800 font-bold px-4 py-2 hover:bg-white font-[family-name:var(--font-inter-tight)]">
                {productType}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setIsEditingType(true)} className="rounded-full text-slate-400 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 transition-all h-8 w-8">
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Button variant="ghost" onClick={onReset} className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full text-sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Scan Another
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <Activity className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-medium animate-pulse">Identifying ingredients...</p>
        </div>
      ) : error ? (
        <div className="bg-[#FAFAF7] p-8 rounded-[14px] text-center border-t-4 border-[#E03A3E]">
          <AlertTriangle className="w-10 h-10 text-[#E03A3E] mx-auto mb-4" />
          <p className="text-slate-800 font-medium mb-4">{error}</p>
          <Button variant="outline" onClick={fetchIdentificationData} className="rounded-full">Try Again</Button>
        </div>
      ) : (
        <>
          {/* STAGE 1 — Identification panel */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-semibold text-lg font-[family-name:var(--font-inter-tight)]">
                We identified {extracted.length} ingredients
              </h2>
              <span className="bg-[#FAFAF7]/10 text-white px-2.5 py-1 rounded-full text-xs font-bold border border-white/10">
                <span className="text-[#3DAA5C] mr-1">●</span> {matched.length} in our database
              </span>
            </div>
            
            <div className="h-[1px] w-full bg-white/10 my-2" />

            <div className="flex flex-wrap gap-2">
              {extracted.map((raw, i) => {
                const match = matched.find(m => m.raw === raw);
                if (match) {
                  return (
                    <button 
                      key={i}
                      onClick={() => scrollToIngredient(match._id)}
                      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAFAF7] border border-[#3DAA5C] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#3DAA5C]" />
                      <span className="text-sm font-semibold text-slate-800">{raw}</span>
                    </button>
                  );
                } else {
                  return (
                    <div 
                      key={i}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-600/50 cursor-default"
                      title="We don't have data on this one yet."
                    >
                      <span className="text-sm font-medium text-slate-400">{raw}</span>
                    </div>
                  );
                }
              })}
            </div>
          </div>

          {/* STAGE 2 — Summary tiles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#FAFAF7] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)] border-t-4 border-[#E03A3E]">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Critical Risk</p>
              <p className="text-5xl font-semibold text-[#E03A3E] font-[family-name:var(--font-inter-tight)] tracking-tight">{criticalCount}</p>
            </div>
            
            <div className="bg-[#FAFAF7] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)] border-t-4 border-[#E89B2C]">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Moderate Concern</p>
              <p className="text-5xl font-semibold text-[#E89B2C] font-[family-name:var(--font-inter-tight)] tracking-tight">{warnCount}</p>
            </div>

            <div className="bg-[#FAFAF7] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)] border-t-4 border-[#3DAA5C]">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Safe / Beneficial</p>
              <p className="text-5xl font-semibold text-[#3DAA5C] font-[family-name:var(--font-inter-tight)] tracking-tight">{safeCount}</p>
            </div>
          </div>

          {/* STAGE 3 — Filter tabs */}
          <div className="flex gap-6 border-b border-white/10 pt-4">
            {["Risks", "Benefits", "All"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-white rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* STAGE 4 — Ingredient detail rows */}
          <div className="space-y-3 pt-2">
            {filteredItems.map((item) => {
              const isOpen = openItems[item._id] || false;
              const isHighlighted = highlightedRowId === item._id;
              
              return (
                <div 
                  id={`ingredient-row-${item._id}`}
                  key={item._id} 
                  className={`bg-[#FAFAF7] rounded-[14px] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)] transition-colors duration-[1500ms] ${isHighlighted ? 'bg-[#3DAA5C]/10' : ''}`}
                >
                  {/* Header Row */}
                  <div 
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus:bg-slate-50"
                    onClick={() => toggleItem(item._id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleItem(item._id); }}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isOpen}
                  >
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: getSeverityDotColor(item.severity) }} 
                    />
                    <span className="font-semibold text-slate-900 text-[15px] flex-1">{item.name}</span>
                    
                    {item.tag && (
                      <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-sm bg-slate-100 text-slate-600">
                        {item.tag}
                      </span>
                    )}
                    
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </div>

                  {/* Expanded Content */}
                  <div 
                    className={`grid transition-all duration-200 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 pb-6 pt-2 border-t border-slate-100/60">
                        
                        {/* Gauges & Context */}
                        {(activeTab === "Risks" || activeTab === "All") && renderGauge(item, "risk")}
                        {(activeTab === "Benefits" || activeTab === "All") && renderGauge(item, "benefit")}

                        {/* Why-this-matters block */}
                        {item.dosage && (item.dosage.rda || item.dosage.safe_upper_limit) && (
                          <div className="mt-6 bg-white border border-slate-100 rounded-xl p-4 text-sm text-slate-600 space-y-2.5 shadow-sm">
                            {item.dosage.rda && (
                              <div className="flex items-center gap-3">
                                <span className="text-lg" title="RDA (healthy adult)">🩺</span>
                                <span className="flex-1 font-medium text-slate-700">RDA (healthy adult)</span>
                                <span className="font-semibold">{item.dosage.rda} {item.dosage.unit}</span>
                              </div>
                            )}
                            {item.dosage.safe_upper_limit && (
                              <div className="flex items-center gap-3">
                                <span className="text-lg" title="Safe upper limit">🛡</span>
                                <span className="flex-1 font-medium text-slate-700">Safe upper limit</span>
                                <span className="font-semibold">{item.dosage.safe_upper_limit} {item.dosage.unit}</span>
                              </div>
                            )}
                            {item.citations && item.citations.length > 0 && item.dosage.authority && (
                              <div className="flex items-center gap-3">
                                <span className="text-lg" title="Source">📚</span>
                                <span className="flex-1 font-medium text-slate-700">Source</span>
                                <a href={item.citations[0]} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                  {item.dosage.authority} <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sources / important notes Details Toggle */}
                        {((item.importantNotes && item.importantNotes.length > 0) || 
                          (item.sources && item.sources.length > 0) || 
                          (item.citations && item.citations.length > 0)) && (
                          <details className="mt-4 group">
                            <summary className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 cursor-pointer select-none">
                              <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                              Show details
                            </summary>
                            <div className="mt-3 pl-6 space-y-4 text-sm text-slate-600">
                              {item.importantNotes && item.importantNotes.length > 0 && (
                                <div>
                                  <strong className="text-slate-800 block mb-1">Important Notes</strong>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {item.importantNotes.map((note: string, i: number) => <li key={i}>{note}</li>)}
                                  </ul>
                                </div>
                              )}
                              {item.sources && item.sources.length > 0 && (
                                <div>
                                  <strong className="text-slate-800 block mb-1">Found naturally in:</strong>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {item.sources.map((src: string, i: number) => <li key={i}>{src}</li>)}
                                  </ul>
                                </div>
                              )}
                              {item.citations && item.citations.length > 0 && (
                                <div>
                                  <strong className="text-slate-800 block mb-1">Citations</strong>
                                  <ol className="list-decimal pl-4 space-y-1">
                                    {item.citations.map((cit: string, i: number) => (
                                      <li key={i}>
                                        <a href={cit} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">
                                          {cit}
                                        </a>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                        
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredItems.length === 0 && (
              <div className="text-center py-12 bg-white/5 border border-white/10 rounded-[14px]">
                <p className="text-slate-400">No {activeTab.toLowerCase()} identified for these ingredients.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
