"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, FileText, Trash2, Eye, Plus, RefreshCw, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { NDA } from "@/types";

function LibrarySkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 flex items-start gap-3">
            <Skeleton className="h-5 w-5 mt-1 rounded" />
            <div className="flex-1">
              <Skeleton className="h-5 w-48 mb-2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [ndas, setNdas] = useState<NDA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNdas = () => {
    setLoading(true);
    setError("");
    fetch("/api/ndas")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load library");
        return r.json();
      })
      .then(setNdas)
      .catch((e) => {
        setError(e.message);
        toast.error("Failed to load NDA library");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNdas();
  }, []);

  const deleteNda = async (id: string) => {
    if (!confirm("Delete this NDA from your library?")) return;
    try {
      const res = await fetch(`/api/ndas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setNdas((prev) => prev.filter((n) => n.id !== id));
      toast.success("NDA deleted");
    } catch {
      toast.error("Failed to delete NDA");
    }
  };

  if (loading) return <LibrarySkeleton />;

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

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--cornerstone-navy)]">NDA Library</h1>
        <Link href="/library/add">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add NDA
          </Button>
        </Link>
      </div>

      {ndas.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted)]">
          <BookOpen size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium text-[var(--cornerstone-navy)] mb-1">No NDAs yet</p>
          <p className="text-sm mb-4">Add your first NDA to start building your library.</p>
          <Link href="/library/add">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First NDA
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {ndas.map((n) => (
            <div key={n.id} className="card p-4 flex items-start gap-3">
              <FileText size={20} className="text-[var(--muted)] mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[var(--cornerstone-navy)] truncate">{n.name}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={n.status} />
                  <span className="text-xs text-[var(--muted)]">{n.clauses?.length || 0} clauses</span>
                  <span className="text-xs text-[var(--muted)]">{new Date(n.dateAdded).toLocaleDateString()}</span>
                </div>
              </div>
              <Link href={`/library/${n.id}`} className="text-[var(--muted)] hover:text-[var(--cornerstone-orange)] p-1">
                <Eye size={16} />
              </Link>
              <button onClick={() => deleteNda(n.id)} className="text-[var(--muted)] hover:text-red-600 p-1">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
