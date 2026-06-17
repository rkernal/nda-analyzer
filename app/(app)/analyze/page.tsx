"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, FileSearch, XCircle, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PdfUpload, CharCount } from "@/components/app/PdfUpload";
import { toast } from "sonner";

function AnalyzeSkeleton() {
  return (
    <div className="max-w-2xl">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="space-y-4">
        <div>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  const router = useRouter();
  const [ndaName, setNdaName] = useState("");
  const [ndaText, setNdaText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ cur: 0, tot: 0, msg: "" });
  const [libCount, setLibCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/ndas")
      .then((r) => r.json())
      .then((data) => setLibCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {
        setLibCount(0);
        toast.error("Failed to load library count");
      });
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-text", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Extraction failed (${res.status}). Try pasting the text instead.`);
        toast.error("File extraction failed");
        return;
      }
      const data = await res.json();
      if (!data.text) {
        setError("No text could be extracted from this file. Try pasting the text instead.");
        toast.error("No text extracted");
        return;
      }
      setNdaText(data.text);
      toast.success("Text extracted successfully");
    } catch {
      setError("Failed to extract text. Check your connection and try again, or paste the text instead.");
      toast.error("File extraction failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setBusy(false);
    setProgress({ cur: 0, tot: 0, msg: "" });
    setError("Analysis cancelled.");
    toast.info("Analysis cancelled");
  };

  const handleAnalyze = async () => {
    if (!ndaText || !libCount) return;
    setError("");
    setBusy(true);
    setProgress({ cur: 0, tot: 1, msg: "Starting analysis..." });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ndaName || "Untitled NDA", text: ndaText }),
        signal: controller.signal,
      });

      if (!res.ok && !res.headers.get("content-type")?.includes("text/event-stream")) {
        const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        setError(data.error || "Analysis failed. Please try again.");
        toast.error("Analysis failed");
        setBusy(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Unable to read response stream.");
        toast.error("Stream error");
        setBusy(false);
        return;
      }

      const decoder = new TextDecoder();
      let analysisId = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.progress) setProgress(data.progress);
            if (data.analysisId) analysisId = data.analysisId;
            if (data.complete && analysisId) {
              toast.success("Analysis complete!");
              router.push(`/results/${analysisId}`);
              return;
            }
            if (data.error) {
              setError(data.error);
              toast.error(data.error);
              setBusy(false);
              return;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      if (analysisId) {
        toast.success("Analysis complete!");
        router.push(`/results/${analysisId}`);
      } else {
        setError("Analysis stream ended unexpectedly. Please try again.");
        toast.error("Analysis stream ended unexpectedly");
        setBusy(false);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("Connection lost during analysis. Please check your network and try again.");
      toast.error("Connection lost during analysis");
      setBusy(false);
    } finally {
      abortRef.current = null;
    }
  };

  if (libCount === null) return <AnalyzeSkeleton />;

  if (busy) {
    const pct = progress.tot ? Math.round((progress.cur / progress.tot) * 100) : 0;
    return (
      <div className="text-center py-16 max-w-md mx-auto">
        <Loader2 size={40} className="animate-spin mx-auto mb-4 text-[var(--cornerstone-orange)]" />
        <p className="font-medium text-lg text-[var(--cornerstone-navy)]">{progress.msg}</p>
        <p className="text-sm text-[var(--muted)] mt-2">
          {progress.tot > 1 ? `${progress.cur} of ${progress.tot} clauses analyzed (${pct}%)` : "Preparing..."}
        </p>
        <div className="w-64 mx-auto mt-4 bg-stone-200 rounded-full h-2.5">
          <div
            className="bg-[var(--cornerstone-orange)] h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: pct + "%" }}
          />
        </div>
        <Button variant="ghost" onClick={handleCancel} className="mt-6 text-[var(--muted)] hover:text-red-600">
          <XCircle className="h-4 w-4 mr-2" />
          Cancel Analysis
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl animate-fade-up">
      <h1 className="font-display text-2xl font-bold text-[var(--cornerstone-navy)] mb-6">Analyze New NDA</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p>{error}</p>
            <button onClick={() => setError("")} className="text-red-600 hover:text-red-700 text-xs mt-1 underline">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {libCount === 0 && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm rounded-md p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p>You need at least one NDA in your library before running an analysis.</p>
            <Link href="/library/add" className="inline-flex items-center gap-1 text-yellow-900 hover:underline text-xs mt-1">
              <Plus className="h-3 w-3" /> Add your first NDA
            </Link>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label>NDA Name (optional)</Label>
          <Input value={ndaName} onChange={(e) => setNdaName(e.target.value)} placeholder="e.g., New Vendor NDA" className="mt-1" />
        </div>

        <div>
          <Label>NDA Text</Label>
          <div className="mt-1">
            <PdfUpload uploading={uploading} onUpload={handleUpload} />
          </div>
          <textarea
            value={ndaText}
            onChange={(e) => setNdaText(e.target.value)}
            rows={12}
            placeholder="Paste the full NDA text you've been asked to sign..."
            className="w-full bg-white border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--cornerstone-orange)] resize-none font-mono"
          />
          <CharCount text={ndaText} />
        </div>

        <Button onClick={handleAnalyze} disabled={!ndaText || libCount === 0} className="w-full">
          <FileSearch className="h-4 w-4 mr-2" />
          Analyze Against My Library ({libCount} NDAs)
        </Button>
      </div>
    </div>
  );
}
