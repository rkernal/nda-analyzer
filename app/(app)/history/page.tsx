"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { History, BarChart3, FileSearch, RefreshCw, AlertTriangle } from "lucide-react";
import { COLORS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AnalysisSummary, AnalysisSummaryRow } from "@/types";

function HistorySkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-40 mb-6" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4">
            <Skeleton className="h-5 w-52 mb-2" />
            <Skeleton className="h-3 w-72" />
            <div className="flex gap-1.5 mt-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<AnalysisSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnalyses = () => {
    setLoading(true);
    setError("");
    fetch("/api/analyses")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load analyses");
        return r.json();
      })
      .then(setAnalyses)
      .catch((e) => {
        setError(e.message);
        toast.error("Failed to load past analyses");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalyses();
  }, []);

  if (loading) return <HistorySkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
        <p className="text-sm text-[var(--muted)] mb-4">{error}</p>
        <Button onClick={fetchAnalyses} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl font-bold text-[var(--cornerstone-navy)] mb-6">Past Analyses</h1>

      {analyses.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted)]">
          <History size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium text-[var(--cornerstone-navy)] mb-1">No analyses yet</p>
          <p className="text-sm mb-4">Run your first analysis to see results here.</p>
          <Link href="/analyze">
            <Button>
              <FileSearch className="h-4 w-4 mr-2" />
              Analyze Your First NDA
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map((a) => {
            const summary = a.summary as AnalysisSummary | undefined;
            return (
              <Link key={a.id} href={`/results/${a.id}`} className="card block p-4 transition-colors hover:bg-stone-50">
                <div className="font-medium text-[var(--cornerstone-navy)] flex items-center gap-2">
                  <BarChart3 size={16} className="text-[var(--cornerstone-orange)]" />
                  {a.ndaName}
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  {new Date(a.createdAt).toLocaleDateString()} &bull; Familiarity: {Math.round(a.familiarityPct || 0)}% &bull; Avg Risk: {(a.avgRiskScore || 0).toFixed(1)}
                </div>
                {summary && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {Object.entries(COLORS).map(([k, v]) => {
                      const count = (summary as unknown as Record<string, number>)[k] || 0;
                      if (count === 0) return null;
                      return (
                        <span key={k} className={`${v.badge} text-white text-xs px-2 py-0.5 rounded-full`}>
                          {count} {v.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
