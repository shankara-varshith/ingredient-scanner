"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Check, Edit2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const [activeTab, setActiveTab] = useState<"Risks" | "Benefits">("Risks");

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

  // KPIs Calculations
  const criticalCount = results.filter(r => r.riskLevel === "Critical risk").length;
  const moderateCount = results.filter(r => r.riskLevel === "Moderate concern").length;
  const safeCount = results.filter(r => r.riskLevel === "Safe / beneficial").length;

  // Filtered Results
  const displayedResults = results.filter(r => {
    if (activeTab === "Risks") {
      return r.riskLevel === "Critical risk" || r.riskLevel === "Moderate concern";
    }
    return r.riskLevel === "Safe / beneficial";
  });

  const getRiskColor = (level: string) => {
    if (level === "Critical risk") return "bg-red-500";
    if (level === "Moderate concern") return "bg-orange-500";
    return "bg-emerald-500";
  };
  
  const getBadgeColor = (level: string) => {
    if (level === "Critical risk") return "bg-red-50 text-red-700 border-red-200";
    if (level === "Moderate concern") return "bg-orange-50 text-orange-700 border-orange-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-x-hidden pb-20">
      
      {/* Top Header & Product Type */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {isEditingType ? (
            <div className="flex items-center gap-2">
              <select
                value={tempType}
                onChange={(e) => setTempType(e.target.value)}
                className="bg-white border-2 border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
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
              <Button variant="outline" className="bg-white rounded-xl shadow-sm border-slate-200 text-slate-800 font-bold px-4 py-2 hover:bg-slate-50 font-[family-name:var(--font-outfit)]">
                {productType}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setIsEditingType(true)} className="rounded-full text-slate-400 hover:text-indigo-600 sm:opacity-0 sm:group-hover:opacity-100 transition-all h-8 w-8">
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Button variant="ghost" onClick={onReset} className="text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded-full text-sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Scan Another
        </Button>
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="space-y-6">
          <div className="flex gap-4">
            <Skeleton className="h-28 flex-1 rounded-2xl bg-white/50" />
            <Skeleton className="h-28 flex-1 rounded-2xl bg-white/50" />
            <Skeleton className="h-28 flex-1 rounded-2xl bg-white/50" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-2xl bg-white/50" />
        </div>
      ) : error ? (
        <Card className="bg-red-50/50 border-red-100 rounded-[2rem]">
          <CardContent className="p-8 text-center text-red-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
            <p className="text-lg font-medium">{error}</p>
            <Button variant="outline" onClick={fetchIngredientsData} className="mt-4 rounded-full">Try Again</Button>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card className="bg-white/50 border-dashed border-2 border-slate-200 rounded-[2rem]">
          <CardContent className="p-12 text-center text-slate-500">
            <h3 className="text-xl font-bold text-slate-700 mb-2">No Records Found</h3>
            <p>We couldn't find detailed health data for these specific ingredients.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Critical Risk Card */}
            <Card className="bg-[#fcf8f6] border-none shadow-sm rounded-2xl">
              <CardContent className="p-5 space-y-1">
                <p className="text-sm font-semibold text-slate-600">Critical risk</p>
                <p className="text-4xl font-bold text-red-600">{criticalCount}</p>
                <p className="text-sm text-slate-500 pt-1">ingredients need attention</p>
              </CardContent>
            </Card>
            
            {/* Moderate Concern Card */}
            <Card className="bg-[#f9f8f4] border-none shadow-sm rounded-2xl">
              <CardContent className="p-5 space-y-1">
                <p className="text-sm font-semibold text-slate-600">Moderate concern</p>
                <p className="text-4xl font-bold text-orange-600">{moderateCount}</p>
                <p className="text-sm text-slate-500 pt-1">ingredients worth knowing</p>
              </CardContent>
            </Card>

            {/* Safe / Beneficial Card */}
            <Card className="bg-[#f6f9f6] border-none shadow-sm rounded-2xl">
              <CardContent className="p-5 space-y-1">
                <p className="text-sm font-semibold text-slate-600">Safe / beneficial</p>
                <p className="text-4xl font-bold text-emerald-700">{safeCount}</p>
                <p className="text-sm text-slate-500 pt-1">ingredients with low risk</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-3 border-b border-slate-200 pb-2 pt-4">
            <button 
              onClick={() => setActiveTab("Risks")}
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${activeTab === "Risks" ? "bg-white border border-slate-200 shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
            >
              Risks
            </button>
            <button 
              onClick={() => setActiveTab("Benefits")}
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${activeTab === "Benefits" ? "bg-white border border-slate-200 shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
            >
              Benefits
            </button>
          </div>

          {/* List Header */}
          <p className="text-xs font-bold text-slate-500 tracking-wider uppercase pl-2">
            {activeTab.toUpperCase()} — CLICK ANY INGREDIENT TO SEE ACTUAL VS SAFE LEVELS
          </p>

          {/* Accordion List */}
          <div className="space-y-3">
            {displayedResults.map((item) => {
              const dotColor = getRiskColor(item.riskLevel);
              const badgeClasses = getBadgeColor(item.riskLevel);
              const hasMetric = !!item.metric;

              return (
                <Accordion key={item._id} className="w-full">
                  <AccordionItem 
                    value={item._id} 
                    className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden"
                  >
                    {/* The Header row with colored left border */}
                    <div className="relative">
                      {/* Left color strip */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${dotColor} opacity-80`} />
                      
                      <AccordionTrigger className="hover:no-underline hover:bg-slate-50 transition-colors py-4 px-5 pl-6 [&[data-state=open]]:border-b border-slate-100">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Dot */}
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                            <span className="font-bold text-slate-800 text-base break-words truncate">
                              {item.name}
                            </span>
                          </div>
                          
                          <Badge variant="outline" className={`ml-4 whitespace-nowrap px-3 py-1 font-semibold border ${badgeClasses}`}>
                            {item.riskCategory}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                    </div>

                    <AccordionContent className="bg-[#fafafc] pt-5 pb-6 px-6">
                      <div className="max-w-3xl space-y-5">
                        
                        {/* Progress Bar Section (If metric exists) */}
                        {hasMetric && (
                          <div className="space-y-2">
                            <div className="flex items-end justify-between">
                              <p className="font-semibold text-slate-800 text-sm">
                                {item.metric.name}
                              </p>
                              <p className="text-xs text-slate-500 font-medium">
                                {item.metric.actual} {item.metric.unit} • safe limit: {item.metric.safeLimit} {item.metric.unit}
                              </p>
                            </div>
                            
                            {/* Visual Progress Bar */}
                            <div className="relative h-2.5 bg-slate-200 rounded-full overflow-visible w-full mt-1">
                              {/* Actual Fill */}
                              <div 
                                className={`absolute top-0 left-0 h-full rounded-full ${item.riskLevel === 'Critical risk' ? 'bg-red-500' : 'bg-orange-400'}`}
                                style={{ width: `${Math.min((item.metric.actual / item.metric.maxScale) * 100, 100)}%` }}
                              />
                              {/* Safe Limit Marker */}
                              <div 
                                className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-slate-800 z-10"
                                style={{ left: `${Math.min((item.metric.safeLimit / item.metric.maxScale) * 100, 100)}%` }}
                              >
                                <span className="absolute top-4 -translate-x-1/2 text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                  safe limit
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Description Text */}
                        <p className={`text-sm text-slate-600 leading-relaxed ${hasMetric ? 'pt-4' : ''}`}>
                          {item.metric?.description || item.description}
                        </p>

                        {/* Additional Benefits (If looking at Benefits tab) */}
                        {activeTab === "Benefits" && item.benefits && item.benefits.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Key Advantages</p>
                            <ul className="space-y-1.5">
                              {item.benefits.map((b: any, i: number) => (
                                <li key={i} className="text-sm text-slate-700">
                                  <span className="font-semibold text-emerald-700">{b.category}:</span> {b.description}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
