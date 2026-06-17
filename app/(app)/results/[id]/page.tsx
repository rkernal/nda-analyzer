"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, AlertTriangle, PenTool, ChevronRight, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { ClauseTag } from "@/components/app/ClauseTag";
import { RiskMeter } from "@/components/app/RiskMeter";
import { COLORS, CATEGORY_ORDER } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Analysis } from "@/types";

function ResultsSkeleton() {
  return (
    <div>
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="card p-5 mb-6">
        <Skeleton className="h-6 w-64 mb-2" />
        <Skeleton className="h-3 w-80 mb-4" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-stone-100 rounded-lg p-3 text-center">
              <Skeleton className="h-8 w-8 mx-auto mb-1" />
              <Skeleton className="h-3 w-14 mx-auto" />
            </div>
          ))}
        </div>
        <Skeleton className="h-3 w-full mb-4" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-5 w-56 mb-3" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-4 mb-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedClause, setExpandedClause] = useState<number | null>(null);

  const fetchResults = () => {
    setLoading(true);
    setError("");
    fetch(`/api/analyses/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load results");
        return r.json();
      })
      .then(setAnalysis)
      .catch((e) => {
        setError(e.message);
        toast.error("Failed to load analysis results");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchResults();
  }, [params.id]);

  if (loading) return <ResultsSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
        <p className="text-sm text-[var(--muted)] mb-4">{error}</p>
        <Button onClick={fetchResults} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!analysis) {
    return <div className="text-center py-20 text-[var(--muted)]">Analysis not found</div>;
  }

  const results = analysis.results || [];
  const summary = analysis.summary;
  const scores = results.filter((c) => c.riskScore).map((c) => c.riskScore);
  const avgRisk = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
  const maxRisk = scores.length > 0 ? Math.max(...scores) : 0;
  const highRisk = scores.filter((s) => s >= 7).length;

  const sortedResults = [...results].sort((a, b) => {
    const oa = CATEGORY_ORDER[a.category] ?? 5;
    const ob = CATEGORY_ORDER[b.category] ?? 5;
    return oa - ob;
  });

  const typeBreakdown: Record<string, number> = {};
  results.forEach((cl) => {
    const t = cl.clauseType || "other";
    typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
  });
  const sortedTypes = Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="animate-fade-up">
      <button onClick={() => router.push("/history")} className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--cornerstone-navy)] text-sm mb-4">
        <ArrowLeft size={16} /> Back to Analyses
      </button>

      {/* Summary Card */}
      <div className="card p-5 mb-6">
        <h2 className="font-display font-semibold text-lg mb-1 flex items-center gap-2 text-[var(--cornerstone-navy)]">
          <BarChart3 size={20} className="text-[var(--cornerstone-orange)]" />
          {analysis.ndaName}
        </h2>
        <div className="text-xs text-[var(--muted)] mb-3 flex items-center gap-3 flex-wrap">
          <span>Compared against {analysis.libSnapshot.ndaCount} NDAs ({analysis.libSnapshot.clauseCount} clauses)</span>
          <span>&bull;</span>
          <span>{new Date(analysis.createdAt).toLocaleDateString()}</span>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          {Object.entries(COLORS).map(([k, v]) => (
            <div key={k} className={v.bg + " rounded-lg p-3 text-center"}>
              <div className={"text-2xl font-bold " + v.text}>{(summary as Record<string, number>)[k] || 0}</div>
              <div className={"text-xs opacity-75 " + v.text}>{v.label}</div>
            </div>
          ))}
        </div>

        {/* Familiarity score */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-[var(--muted)]">Familiarity Score:</span>
          <div className="flex-1 bg-stone-200 rounded-full h-3">
            <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${analysis.familiarityPct}%` }} />
          </div>
          <span className="text-sm font-medium text-[var(--cornerstone-navy)]">{Math.round(analysis.familiarityPct)}%</span>
        </div>

        {/* Alerts */}
        {(summary.red > 0 || summary.white > 0) && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              {summary.red > 0 && `${summary.red} clause(s) match language you've previously declined. `}
              {summary.white > 0 && `${summary.white} clause(s) contain entirely new language. `}
              Review these carefully.
            </p>
          </div>
        )}
        {summary.orange > 0 && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
            <PenTool size={16} className="text-orange-500 mt-0.5 shrink-0" />
            <p className="text-sm text-orange-700">{summary.orange} clause(s) contain language you&apos;ve successfully negotiated before.</p>
          </div>
        )}
        {summary.conflicted > 0 && (
          <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2">
            <AlertTriangle size={16} className="text-purple-500 mt-0.5 shrink-0" />
            <p className="text-sm text-purple-700">{summary.conflicted} clause(s) match language found in both signed AND declined NDAs.</p>
          </div>
        )}

        {/* Risk assessment */}
        {scores.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--muted)]">Overall Risk Assessment</span>
              <span className="text-xs text-[var(--muted)]">
                {highRisk > 0 ? `${highRisk} high-risk clause${highRisk > 1 ? "s" : ""}` : "No high-risk clauses"}
              </span>
            </div>
            <RiskMeter score={Math.round(avgRisk)} />
            <div className="flex gap-4 mt-2">
              <span className="text-xs text-[var(--muted)]">Avg: {avgRisk}/10</span>
              <span className="text-xs text-[var(--muted)]">Max: {maxRisk}/10</span>
              <span className="text-xs text-[var(--muted)]">{scores.length} clauses scored</span>
            </div>
          </div>
        )}

        {/* Clause types */}
        {sortedTypes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <span className="text-sm text-[var(--muted)] mb-2 block">Clause Types Found</span>
            <div className="flex flex-wrap gap-1.5">
              {sortedTypes.map(([t, count]) => (
                <span key={t} className="flex items-center gap-1">
                  <ClauseTag type={t} />
                  <span className="text-xs text-[var(--muted)]">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clause-by-clause breakdown */}
      <h3 className="font-medium text-[var(--cornerstone-navy)] mb-3">Clause-by-Clause Breakdown</h3>
      {sortedResults.map((clause, i) => {
        const c = COLORS[clause.category] || COLORS.white;
        const isOpen = expandedClause === i;
        return (
          <div
            key={i}
            onClick={() => setExpandedClause(isOpen ? null : i)}
            className={`${c.bg} border ${c.border} rounded-xl p-4 mb-3 cursor-pointer transition-all hover:shadow-md`}
          >
            <div className="flex items-start gap-3">
              <span className={`${c.badge} text-white text-xs px-2 py-0.5 rounded-full shrink-0 mt-0.5`}>{c.label}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={`font-medium ${c.text}`}>{clause.title}</h4>
                  {clause.clauseType && <ClauseTag type={clause.clauseType} />}
                  {clause.riskScore && <RiskMeter score={clause.riskScore} size="sm" />}
                </div>
                <p className={`text-sm mt-1 opacity-75 ${c.text} ${isOpen ? "" : "line-clamp-2"}`}>{clause.text}</p>
              </div>
              <ChevronRight size={16} className={`${c.text} shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            </div>

            {isOpen && (
              <div className="mt-3 pt-3 border-t border-black/10 space-y-3">
                {clause.riskScore && (
                  <div>
                    <RiskMeter score={clause.riskScore} />
                    {clause.riskReasoning && (
                      <div className="mt-2 p-3 bg-white/60 rounded-lg">
                        <div className="text-xs font-semibold text-slate-800 mb-1">Risk Analysis</div>
                        <div className="text-sm text-slate-700 leading-relaxed">{clause.riskReasoning}</div>
                      </div>
                    )}
                  </div>
                )}
                <div className={`text-sm ${c.text}`}><strong>Familiarity:</strong> {clause.explanation}</div>
                {clause.matchedNda && <div className={`text-sm ${c.text}`}><strong>Matched NDA:</strong> {clause.matchedNda}</div>}
                {clause.matchedClause && <div className={`text-sm ${c.text}`}><strong>Matched Clause:</strong> {clause.matchedClause}</div>}
                {clause.suggestedAlternative && (
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-xs font-medium text-orange-800 mb-1">Your Past Alternative:</div>
                    <div className="text-sm text-orange-900">{clause.suggestedAlternative}</div>
                  </div>
                )}
                {clause.category === "conflicted" && (
                  <div className="bg-white/60 rounded-lg p-3 space-y-2">
                    <div className="text-xs font-semibold text-purple-900 mb-1">Conflict Detected</div>
                    {clause.agreedIn && (
                      <div className="flex items-start gap-2">
                        <CheckCircle size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                        <div><span className="text-xs font-medium text-emerald-800">Agreed in:</span> <span className="text-sm text-slate-700">{clause.agreedIn}</span></div>
                      </div>
                    )}
                    {clause.declinedIn && (
                      <div className="flex items-start gap-2">
                        <AlertCircle size={14} className="text-red-600 mt-0.5 shrink-0" />
                        <div><span className="text-xs font-medium text-red-800">Declined in:</span> <span className="text-sm text-slate-700">{clause.declinedIn}</span></div>
                      </div>
                    )}
                    {clause.conflictNote && (
                      <div className="pt-2 border-t border-purple-200">
                        <div className="text-xs font-medium text-purple-800 mb-0.5">Recommendation:</div>
                        <div className="text-sm text-purple-900">{clause.conflictNote}</div>
                      </div>
                    )}
                  </div>
                )}
                {clause.confidence !== undefined && (
                  <div className={`text-xs opacity-50 ${c.text}`}>Confidence: {Math.round(clause.confidence * 100)}%</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
