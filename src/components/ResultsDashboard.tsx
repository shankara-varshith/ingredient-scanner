"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft, Check, Edit2, AlertTriangle, ChevronDown,
  ChevronRight, Activity, ExternalLink, ShieldAlert, Leaf, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { classifyIngredient } from "@/utils/bucketClassifier";

interface ResultsDashboardProps {
  initialData: { productType: string; ingredients: string[] };
  onReset: () => void;
}

/* ── Colour tokens (keep these in one place) ──────────────── */
const C = {
  risk:     { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   text: "#EF4444", pill: "rgba(239,68,68,0.12)"   },
  moderate: { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  text: "#F59E0B", pill: "rgba(245,158,11,0.12)"  },
  safe:     { bg: "rgba(0,220,130,0.07)",   border: "rgba(0,220,130,0.22)",   text: "#00D97E", pill: "rgba(0,220,130,0.10)"   },
} as const;

type TabKey = "All" | "Risks" | "Moderate" | "Benefits";
type CategoryKey = "Critical" | "Moderate" | "Safe";

function categoryColors(cat: CategoryKey) {
  if (cat === "Critical") return C.risk;
  if (cat === "Moderate") return C.moderate;
  return C.safe;
}

function severityDotColor(severity: string) {
  if (severity === "critical") return "#EF4444";
  if (severity === "warn")     return "#F59E0B";
  if (severity === "benefit")  return "#00D97E";
  return "#00D97E";
}

function riskBarColor(level: string, exceeds: boolean) {
  if (exceeds) return "#EF4444";
  if (level === "high")   return "#EF4444";
  if (level === "medium") return "#F59E0B";
  return "#00D97E";
}

export default function ResultsDashboard({ initialData, onReset }: ResultsDashboardProps) {
  const [productType, setProductType] = useState(initialData.productType);
  const [isEditingType, setIsEditingType] = useState(false);
  const [tempType, setTempType] = useState(initialData.productType);

  const [loading, setLoading] = useState(true);
  const [matched, setMatched] = useState<any[]>([]);
  const [extracted, setExtracted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("All");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveType = () => { setProductType(tempType); setIsEditingType(false); };
  const toggleItem = (id: string) => setOpenItems(p => ({ ...p, [id]: !p[id] }));

  const scrollToIngredient = (id: string) => {
    setOpenItems(p => ({ ...p, [id]: true }));
    setHighlightedId(id);
    setTimeout(() => {
      document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    setTimeout(() => setHighlightedId(null), 1800);
  };

  /* ── KPI counts ─────────────────────────────────────────── */
  let critCount = 0, modCount = 0, safeCount = 0;
  const categorized = matched.map(ing => {
    const cat = classifyIngredient(ing) as CategoryKey;
    if (cat === "Critical") critCount++;
    else if (cat === "Moderate") modCount++;
    else safeCount++;
    return { ...ing, category: cat };
  });

  const filtered = categorized.filter(item => {
    if (activeTab === "Risks")    return item.category === "Critical";
    if (activeTab === "Moderate") return item.category === "Moderate";
    if (activeTab === "Benefits") return item.category === "Safe";
    return true;
  });

  /* ── Gauge bars ─────────────────────────────────────────── */
  const renderGauges = (item: any, type: "risk" | "benefit") => {
    const list = type === "risk" ? item.risks : item.benefits;
    if (!list?.length) return null;

    return (
      <div className="space-y-7 mt-5">
        {list.map((d: any, i: number) => {
          const max = d.max || 100;
          const pct = Math.min((d.actual / max) * 100, 100);
          const safePct = d.safe ? Math.min((d.safe / max) * 100, 100) : 0;
          const rdaPct = item.dosage?.rda ? Math.min((item.dosage.rda / max) * 100, 100) : null;
          const exceeds = d.actual > d.safe;
          const barColor = type === "risk" ? riskBarColor(d.severity_level, exceeds) : "#00D97E";

          return (
            <div key={i} className="space-y-2">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-200">{d.label}</span>
                  {exceeds && type === "risk" && (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  )}
                </div>
                <span className="text-[11px] text-slate-500">
                  {d.actual} {d.unit} &middot; safe {d.safe ?? "?"} {d.unit}
                </span>
              </div>

              {/* Bar */}
              <div
                className="relative h-2 rounded-full w-full overflow-visible"
                style={{ background: "rgba(255,255,255,0.07)" }}
                role="progressbar"
                aria-valuenow={d.actual}
                aria-valuemin={0}
                aria-valuemax={max}
              >
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}60` }}
                />
                {rdaPct !== null && (
                  <div
                    className="absolute -top-2.5 w-3 h-3 -translate-x-1/2 flex items-center justify-center cursor-help"
                    style={{ left: `${rdaPct}%` }}
                    title="Recommended daily allowance"
                  >
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  </div>
                )}
                {d.safe && (
                  <div
                    className="absolute top-[-3px] bottom-[-3px] w-px -translate-x-1/2"
                    style={{ left: `${safePct}%`, backgroundColor: "rgba(255,255,255,0.25)" }}
                  >
                    <div className="absolute top-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-600 whitespace-nowrap">
                      safe
                    </div>
                  </div>
                )}
              </div>

              {d.context && (
                <p className="text-[13px] text-slate-500 leading-relaxed pt-1">{d.context}</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /* ── Loading skeleton ───────────────────────────────────── */
  const Skeleton = () => (
    <div className="space-y-3 pt-4">
      {[180, 140, 200].map(w => (
        <div key={w} className="h-[72px] rounded-2xl shimmer" style={{ opacity: 0.6 }} />
      ))}
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-7 animate-in fade-in duration-500 pb-20">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {isEditingType ? (
          <div className="flex items-center gap-2">
            <select
              value={tempType}
              onChange={e => setTempType(e.target.value)}
              className="bg-[#0D1610] border border-white/10 rounded-xl px-3 py-1.5 text-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {["Food", "Beauty/Cosmetics", "Supplement", "Other"].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <Button
              size="icon"
              onClick={handleSaveType}
              className="rounded-xl h-9 w-9 bg-emerald-600 hover:bg-emerald-500 text-white"
              aria-label="Save product type"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <span
              className="px-3.5 py-1.5 rounded-xl text-sm font-bold text-slate-200 border border-white/8"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              {productType}
            </span>
            <button
              onClick={() => setIsEditingType(true)}
              className="rounded-full p-1.5 text-slate-600 hover:text-emerald-400 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Edit product type"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={onReset}
          className="text-slate-500 hover:text-slate-200 hover:bg-white/6 rounded-full text-sm self-start sm:self-auto"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Scan another
        </Button>
      </div>

      {/* ── States ──────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Activity className="w-7 h-7 text-emerald-500 animate-spin" />
          <p className="text-slate-500 text-sm font-medium animate-pulse">Identifying ingredients…</p>
          <Skeleton />
        </div>
      ) : error ? (
        <div
          className="p-8 rounded-2xl text-center"
          style={{ background: C.risk.bg, border: `1px solid ${C.risk.border}` }}
        >
          <ShieldAlert className="w-9 h-9 text-red-400 mx-auto mb-3" />
          <p className="text-slate-300 font-medium mb-5">{error}</p>
          <Button variant="outline" onClick={fetchData} className="rounded-full border-white/10 text-slate-300 hover:bg-white/6">
            Try again
          </Button>
        </div>
      ) : (
        <>
          {/* ── Ingredient chips ─────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-white font-semibold text-base font-[family-name:var(--font-inter-tight)]">
                {extracted.length} ingredient{extracted.length !== 1 ? "s" : ""} detected
              </h2>
              <div
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: C.safe.pill, color: C.safe.text }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {matched.length} identified
              </div>
              {extracted.length - matched.length > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#6B7280" }}
                >
                  <Minus className="w-3 h-3" />
                  {extracted.length - matched.length} unknown
                </div>
              )}
            </div>

            <div className="h-px w-full" style={{ background: "rgba(255,255,255,0.07)" }} />

            <div className="flex flex-wrap gap-2">
              {extracted.map((raw, i) => {
                const match = matched.find(m => m.raw === raw);
                if (match) {
                  const cat = classifyIngredient(match) as CategoryKey;
                  const col = categoryColors(cat);
                  return (
                    <button
                      key={i}
                      onClick={() => scrollToIngredient(match._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                      style={{ background: col.pill, border: `1px solid ${col.border}`, color: col.text }}
                      title={`${cat} — click to jump`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                      {raw}
                    </button>
                  );
                }
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-default"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#4B5563" }}
                    title="Not in our database yet"
                  >
                    {raw}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── KPI tiles ───────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {([
              { key: "Risks",    label: "Critical Risk",       count: critCount, col: C.risk     },
              { key: "Moderate", label: "Moderate",            count: modCount,  col: C.moderate },
              { key: "Benefits", label: "Safe / Beneficial",   count: safeCount, col: C.safe     },
            ] as const).map(({ key, label, count, col }) => (
              <button
                key={key}
                onClick={() => setActiveTab(activeTab === key ? "All" : key)}
                className="relative p-4 sm:p-5 rounded-2xl text-left transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                style={{
                  background: activeTab === key ? col.bg : "rgba(255,255,255,0.03)",
                  border: `1px solid ${activeTab === key ? col.border : "rgba(255,255,255,0.08)"}`,
                  boxShadow: activeTab === key ? `0 0 24px ${col.text}18` : "none",
                }}
                aria-pressed={activeTab === key}
              >
                {/* Top accent line */}
                <div
                  className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full transition-opacity"
                  style={{ background: col.text, opacity: activeTab === key ? 0.7 : 0.25 }}
                  aria-hidden
                />
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: activeTab === key ? col.text : "#4B5563" }}>
                  {label}
                </p>
                <p className="text-4xl sm:text-5xl font-black tracking-tight font-[family-name:var(--font-inter-tight)]" style={{ color: col.text }}>
                  {count}
                </p>
              </button>
            ))}
          </div>

          {/* ── Filter tabs ─────────────────────────────────── */}
          <div className="flex gap-1 p-1 rounded-2xl w-fit" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["All", "Risks", "Moderate", "Benefits"] as TabKey[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
                style={activeTab === tab
                  ? { background: "rgba(255,255,255,0.10)", color: "#F1F5F2", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
                  : { color: "#4B5563" }}
              >
                {tab}
                {tab !== "All" && (
                  <span className="ml-1.5 text-[10px] opacity-60">
                    {tab === "Risks" ? critCount : tab === "Moderate" ? modCount : safeCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Ingredient rows ──────────────────────────────── */}
          <div className="space-y-2.5">
            {filtered.map(item => {
              const isOpen = openItems[item._id] || false;
              const isHighlighted = highlightedId === item._id;
              const cat = item.category as CategoryKey;
              const col = categoryColors(cat);

              return (
                <div
                  id={`row-${item._id}`}
                  key={item._id}
                  className="rounded-2xl overflow-hidden transition-all duration-700"
                  style={{
                    background: isHighlighted
                      ? `linear-gradient(135deg, ${col.bg}, rgba(255,255,255,0.02))`
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isOpen ? col.border : "rgba(255,255,255,0.07)"}`,
                    boxShadow: isOpen ? `0 4px 24px rgba(0,0,0,0.3)` : "none",
                  }}
                >
                  {/* ── Row header ── */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer transition-colors hover:bg-white/[0.02] focus:outline-none focus-visible:bg-white/[0.02]"
                    onClick={() => toggleItem(item._id)}
                    aria-expanded={isOpen}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: severityDotColor(item.severity), boxShadow: `0 0 6px ${severityDotColor(item.severity)}80` }}
                    />
                    <span className="font-semibold text-slate-100 text-[15px] flex-1 text-left">{item.name}</span>

                    {item.tag && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider hidden sm:inline-flex"
                        style={{ background: "rgba(255,255,255,0.06)", color: "#6B7280", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        {item.tag}
                      </span>
                    )}

                    {/* Category badge */}
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ background: col.pill, color: col.text }}
                    >
                      {cat}
                    </span>

                    <ChevronDown
                      className="w-4 h-4 flex-shrink-0 transition-transform duration-200 text-slate-600"
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </button>

                  {/* ── Expanded body ── */}
                  <div className={`grid transition-all duration-250 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <div
                        className="px-5 pb-6 pt-3 space-y-1"
                        style={{ borderTop: `1px solid rgba(255,255,255,0.06)` }}
                      >
                        {renderGauges(item, "risk")}
                        {renderGauges(item, "benefit")}

                        {/* Dosage reference block */}
                        {item.dosage && (item.dosage.rda || item.dosage.safe_upper_limit) && (
                          <div
                            className="mt-6 rounded-xl p-4 text-sm space-y-2.5"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                          >
                            {item.dosage.rda && (
                              <div className="flex items-center gap-3">
                                <Leaf className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                <span className="flex-1 text-slate-400 font-medium">RDA (healthy adult)</span>
                                <span className="font-bold text-slate-200">{item.dosage.rda} {item.dosage.unit}</span>
                              </div>
                            )}
                            {item.dosage.safe_upper_limit && (
                              <div className="flex items-center gap-3">
                                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                <span className="flex-1 text-slate-400 font-medium">Safe upper limit</span>
                                <span className="font-bold text-slate-200">{item.dosage.safe_upper_limit} {item.dosage.unit}</span>
                              </div>
                            )}
                            {item.citations?.length > 0 && item.dosage.authority && (
                              <div className="flex items-center gap-3">
                                <ExternalLink className="w-4 h-4 text-slate-600 flex-shrink-0" />
                                <span className="flex-1 text-slate-400 font-medium">Source</span>
                                <a
                                  href={item.citations[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                                >
                                  {item.dosage.authority}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Expandable details */}
                        {((item.importantNotes?.length) || (item.sources?.length) || (item.citations?.length)) && (
                          <details className="mt-4 group">
                            <summary className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-400 cursor-pointer select-none transition-colors">
                              <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                              More details
                            </summary>
                            <div className="mt-3 pl-5 space-y-4 text-sm text-slate-500">
                              {item.importantNotes?.length > 0 && (
                                <div>
                                  <strong className="text-slate-400 block mb-1.5 text-xs uppercase tracking-wider">Important notes</strong>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {item.importantNotes.map((n: string, i: number) => <li key={i}>{n}</li>)}
                                  </ul>
                                </div>
                              )}
                              {item.sources?.length > 0 && (
                                <div>
                                  <strong className="text-slate-400 block mb-1.5 text-xs uppercase tracking-wider">Found naturally in</strong>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {item.sources.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                  </ul>
                                </div>
                              )}
                              {item.citations?.length > 0 && (
                                <div>
                                  <strong className="text-slate-400 block mb-1.5 text-xs uppercase tracking-wider">Citations</strong>
                                  <ol className="list-decimal pl-4 space-y-1">
                                    {item.citations.map((c: string, i: number) => (
                                      <li key={i}>
                                        <a href={c} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-400 break-all transition-colors">
                                          {c}
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

            {filtered.length === 0 && (
              <div
                className="text-center py-14 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-slate-600 text-sm">No {activeTab.toLowerCase()} identified for these ingredients.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
