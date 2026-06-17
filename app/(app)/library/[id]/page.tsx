"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, AlertCircle, CheckCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { ClauseTag } from "@/components/app/ClauseTag";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { NDA, Clause } from "@/types";

function NdaDetailSkeleton() {
  return (
    <div>
      <Skeleton className="h-4 w-28 mb-4" />
      <Skeleton className="h-8 w-64 mb-2" />
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-4 w-32 mb-3" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card p-3 mb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full mt-2" />
        </div>
      ))}
    </div>
  );
}

export default function NdaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [nda, setNda] = useState<NDA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"final" | "original">("final");
  const [selectedClause, setSelectedClause] = useState<{ type: string; index: number } | null>(null);

  const fetchNda = () => {
    setLoading(true);
    setError("");
    fetch(`/api/ndas/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load NDA");
        return r.json();
      })
      .then(setNda)
      .catch((e) => {
        setError(e.message);
        toast.error("Failed to load NDA details");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNda();
  }, [params.id]);

  if (loading) return <NdaDetailSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
        <p className="text-sm text-[var(--muted)] mb-4">{error}</p>
        <Button onClick={fetchNda} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!nda) {
    return <div className="text-center py-20 text-[var(--muted)]">NDA not found</div>;
  }

  const hasOriginal =
    (nda.status === "signed-remediated" || nda.status === "declined-remediated") && !!nda.originalClauses;
  const showOriginal = tab === "original" && hasOriginal;
  const clauses = (showOriginal ? nda.originalClauses : nda.clauses) as Clause[];
  const clauseType = showOriginal ? "original" : "final";

  // Clause detail view
  if (selectedClause) {
    const isOriginal = selectedClause.type === "original";
    const list = (isOriginal ? nda.originalClauses : nda.clauses) as Clause[];
    const idx = selectedClause.index;
    const cl = list?.[idx];
    if (!cl) return null;

    const otherList = (isOriginal ? nda.clauses : nda.originalClauses) as Clause[] | null;

    return (
      <div className="animate-fade-up">
        <div className="flex justify-between items-start mb-4">
          <button onClick={() => setSelectedClause(null)} className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--cornerstone-navy)] text-sm">
            <ArrowLeft size={16} /> Back to {nda.name}
          </button>
        </div>

        <div className={`rounded-lg p-4 mb-4 border ${isOriginal ? "bg-red-50 border-red-200" : "card"}`}>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs text-[var(--muted)]">Clause {idx + 1} of {list.length}</span>
            {cl.clauseType && <ClauseTag type={cl.clauseType} />}
            {isOriginal && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Original</span>}
            {!isOriginal && nda.status === "signed-remediated" && (
              <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">Final</span>
            )}
            {!isOriginal && nda.status === "declined-remediated" && (
              <span className="text-xs px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded">Last Version</span>
            )}
          </div>
          <h3 className={`font-semibold text-lg mb-3 ${isOriginal ? "text-red-700" : "text-[var(--cornerstone-navy)]"}`}>{cl.title}</h3>
          <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">{cl.text}</p>
        </div>

        {otherList?.[idx] && (
          <div className={`rounded-lg p-4 mb-4 border ${
            isOriginal
              ? nda.status === "declined-remediated" ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"
              : "bg-red-50 border-red-200"
          }`}>
            <h4 className={`text-xs font-medium mb-2 ${
              isOriginal
                ? nda.status === "declined-remediated" ? "text-rose-700" : "text-emerald-700"
                : "text-red-700"
            }`}>
              {isOriginal
                ? nda.status === "declined-remediated" ? "Last Version Before Declining" : "Final Negotiated Version"
                : "Original Version"}
            </h4>
            <p className="text-sm text-[var(--muted)] leading-relaxed whitespace-pre-wrap">{otherList[idx].text}</p>
          </div>
        )}

        <div className="flex gap-2">
          {idx > 0 && (
            <button
              onClick={() => setSelectedClause({ type: selectedClause.type, index: idx - 1 })}
              className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm flex items-center justify-center gap-1 text-[var(--cornerstone-navy)]"
            >
              <ArrowLeft size={14} /> Previous
            </button>
          )}
          {idx < list.length - 1 && (
            <button
              onClick={() => setSelectedClause({ type: selectedClause.type, index: idx + 1 })}
              className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm flex items-center justify-center gap-1 text-[var(--cornerstone-navy)]"
            >
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <button onClick={() => router.push("/library")} className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--cornerstone-navy)] text-sm mb-4">
        <ArrowLeft size={16} /> Back to Library
      </button>

      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-[var(--cornerstone-navy)]">{nda.name}</h1>
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge status={nda.status} />
          <span className="text-xs text-[var(--muted)]">{clauses?.length || 0} clauses</span>
          <span className="text-xs text-[var(--muted)]">{new Date(nda.dateAdded).toLocaleDateString()}</span>
        </div>
      </div>

      {hasOriginal && (
        <div className="flex bg-stone-100 rounded-lg p-1 mb-4">
          <button
            onClick={() => setTab("final")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              tab === "final"
                ? nda.status === "declined-remediated" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                : "text-[var(--muted)] hover:text-[var(--cornerstone-navy)]"
            }`}
          >
            {nda.status === "declined-remediated" ? (
              <><AlertCircle size={14} /> Last Version</>
            ) : (
              <><CheckCircle size={14} /> Final Signed</>
            )}
          </button>
          <button
            onClick={() => setTab("original")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              tab === "original" ? "bg-red-600 text-white" : "text-[var(--muted)] hover:text-[var(--cornerstone-navy)]"
            }`}
          >
            <AlertCircle size={14} /> Original Draft
          </button>
        </div>
      )}

      <h4 className="text-sm font-medium text-[var(--cornerstone-navy)] mb-2">
        {showOriginal ? "Original Clauses" : hasOriginal ? "Final Clauses" : "Clauses"} ({clauses?.length || 0})
      </h4>

      {clauses?.map((c, i) => (
        <button
          key={i}
          onClick={() => setSelectedClause({ type: clauseType, index: i })}
          className={`w-full text-left rounded-lg p-3 mb-2 transition-all border group ${
            showOriginal ? "bg-red-50 hover:bg-red-100 border-red-200" : "card hover:bg-stone-50"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)] shrink-0 w-6">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`text-sm font-medium ${showOriginal ? "text-red-700" : "text-[var(--cornerstone-navy)]"}`}>{c.title}</div>
                {c.clauseType && <ClauseTag type={c.clauseType} />}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1 truncate">{c.text}</div>
            </div>
            <ChevronRight size={14} className="text-[var(--muted)] group-hover:text-[var(--cornerstone-orange)] shrink-0" />
          </div>
        </button>
      ))}
    </div>
  );
}
