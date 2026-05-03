"use client";

import { useState, useEffect } from "react";
import { Loader2, ArrowLeft, Edit2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onReset} className="text-slate-500 hover:text-slate-800">
          <ArrowLeft className="mr-2 h-4 w-4" /> Scan Another
        </Button>
      </div>

      <div className="bg-white/70 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-white/40 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500">Detected Product Type</p>
          {isEditingType ? (
            <div className="flex items-center gap-3">
              <select
                value={tempType}
                onChange={(e) => setTempType(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Food">Food</option>
                <option value="Beauty/Cosmetics">Beauty/Cosmetics</option>
                <option value="Supplement">Supplement</option>
                <option value="Other">Other</option>
              </select>
              <Button size="icon" variant="default" onClick={handleSaveType} className="h-9 w-9 bg-indigo-600 hover:bg-indigo-700">
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-800 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                {productType}
              </h2>
              <Button size="icon" variant="ghost" onClick={() => setIsEditingType(true)} className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        
        <div className="text-right">
          <p className="text-sm font-medium text-slate-500">Ingredients Found</p>
          <p className="text-2xl font-bold text-slate-800">{initialData.ingredients.length}</p>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/40 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
            <p>Fetching health data...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 flex flex-col items-center">
            <AlertTriangle className="h-12 w-12 mb-4 text-red-400" />
            <p>{error}</p>
            <Button variant="outline" onClick={fetchIngredientsData} className="mt-4">Try Again</Button>
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-lg">We couldn't find detailed health data for these specific ingredients in our database yet.</p>
            <p className="text-sm mt-2 opacity-70">Extracted: {initialData.ingredients.join(", ")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[200px]">Ingredient</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Key Benefits</TableHead>
                  <TableHead>Risks / Warnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((item) => (
                  <TableRow key={item._id} className="hover:bg-slate-50/40 transition-colors">
                    <TableCell className="font-semibold text-slate-800 align-top">
                      {item.name}
                    </TableCell>
                    <TableCell className="text-slate-600 align-top text-sm">
                      {item.description}
                    </TableCell>
                    <TableCell className="align-top">
                      <ul className="space-y-2">
                        {item.benefits.map((b: any, i: number) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium text-emerald-600">{b.category}:</span>{" "}
                            <span className="text-slate-600">{b.description}</span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-2 text-sm">
                        {item.risksAndDeficiency?.excess && (
                          <p className="text-rose-600">
                            <span className="font-medium">Excess:</span> {item.risksAndDeficiency.excess}
                          </p>
                        )}
                        {item.risksAndDeficiency?.deficiency && (
                          <p className="text-amber-600">
                            <span className="font-medium">Deficiency:</span> {item.risksAndDeficiency.deficiency}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
