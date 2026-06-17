"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PenTool, AlertTriangle, AlertCircle, FileSearch, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { NDA } from "@/types";

function PlaybookSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-52 mb-6" />
      <div className="card p-5 mb-6">
        <Skeleton className="h-5 w-28 mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-stone-100 rounded-lg p-3 text-center">
              <Skeleton className="h-8 w-10 mx-auto mb-1" />
              <Skeleton className="h-3 w-20 mx-auto" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="card p-4">
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-3 w-56 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlaybookPage() {
  const [ndas, setNdas] = useState<NDA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNdas = () => {
    setLoading(true);
    setError("");
    fetch("/api/ndas")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load playbook data");
        return r.json();
      })
      .then(setNdas)
      .catch((e) => {
        setError(e.message);
        toast.error("Failed to load playbook");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNdas();
  }, []);

  if (loading) return <PlaybookSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
        <p className="text-sm text-[var(--muted)] mb-4">{error}</p>
        <Button onClick={fetchNdas} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const signedAsIs = ndas.filter((n) => n.status === "signed-asis");
  const remediated = ndas.filter((n) => n.status === "signed-remediated" && n.originalClauses);
  const declinedRemediated = ndas.filter((n) => n.status === "declined-remediated" && n.originalClauses);
  const declined = ndas.filter((n) => n.status === "declined");

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl font-bold text-[var(--cornerstone-navy)] mb-6">Negotiation Playbook</h1>

      <div className="card p-5 mb-6">
        <h2 className="font-semibold mb-3 text-[var(--cornerstone-navy)]">Library Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{signedAsIs.length}</div>
            <div className="text-xs text-[var(--muted)]">Signed As-Is</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{remediated.length}</div>
            <div className="text-xs text-[var(--muted)]">Signed Remediated</div>
          </div>
          <div className="bg-rose-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-rose-600">{declinedRemediated.length}</div>
            <div className="text-xs text-[var(--muted)]">Declined Remediated</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{declined.length}</div>
            <div className="text-xs text-[var(--muted)]">Declined</div>
          </div>
        </div>
      </div>

      {remediated.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-[var(--cornerstone-navy)] mb-3 flex items-center gap-2">
            <PenTool size={16} className="text-orange-500" />
            Your Redline History
          </h3>
          {remediated.map((n) => (
            <div key={n.id} className="card p-4 mb-3">
              <div className="font-medium text-orange-700 mb-2">{n.name}</div>
              <div className="text-xs text-[var(--muted)] mb-2">
                Original: {n.originalClauses?.length || 0} clauses — Final: {n.clauses?.length || 0} clauses
              </div>
              <div className="text-sm text-[var(--muted)]">
                Clauses modified during negotiation. Use &quot;Analyze New NDA&quot; to detect similar language.
              </div>
            </div>
          ))}
        </div>
      )}

      {declinedRemediated.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-[var(--cornerstone-navy)] mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-500" />
            Declined After Negotiation
          </h3>
          {declinedRemediated.map((n) => (
            <div key={n.id} className="card p-4 mb-3 border-rose-200">
              <div className="font-medium text-rose-700 mb-2">{n.name}</div>
              <div className="text-xs text-[var(--muted)] mb-2">
                Original: {n.originalClauses?.length || 0} clauses — Last version: {n.clauses?.length || 0} clauses
              </div>
              <div className="text-sm text-[var(--muted)]">
                Negotiation attempted but ultimately declined. Deal-breaker clauses inform future analysis.
              </div>
            </div>
          ))}
        </div>
      )}

      {declined.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-[var(--cornerstone-navy)] mb-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            Declined NDAs
          </h3>
          {declined.map((n) => (
            <div key={n.id} className="card p-4 mb-3 border-red-200">
              <div className="font-medium text-red-700">{n.name}</div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {n.clauses?.length || 0} clauses flagged as disagreed language
              </div>
            </div>
          ))}
        </div>
      )}

      {remediated.length === 0 && declinedRemediated.length === 0 && declined.length === 0 && (
        <div className="text-center py-12 text-[var(--muted)]">
          <PenTool size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium text-[var(--cornerstone-navy)] mb-1">No playbook data yet</p>
          <p className="text-sm mb-4">Your playbook builds as you add NDAs. Add some to get started.</p>
          <Link href="/analyze">
            <Button>
              <FileSearch className="h-4 w-4 mr-2" />
              Run Your First Analysis
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
