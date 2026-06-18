"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PdfUpload, CharCount } from "@/components/app/PdfUpload";
import { STATUS_LABELS } from "@/lib/constants";
import { toast } from "sonner";

export default function AddNdaPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", status: "signed-asis", text: "", orig: "" });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState({ cur: 0, tot: 0, msg: "" });
  const [error, setError] = useState("");
  const [fromAnalysis, setFromAnalysis] = useState(false);

  // Pre-fill from an analyzed NDA handed over by the results page (Add to library).
  useEffect(() => {
    const raw = sessionStorage.getItem("nda-prefill");
    if (!raw) return;
    sessionStorage.removeItem("nda-prefill");
    try {
      const { name, text } = JSON.parse(raw);
      setForm((p) => ({ ...p, name: name || p.name, text: text || p.text }));
      setFromAnalysis(true);
    } catch {
      // ignore malformed prefill
    }
  }, []);

  const handleUpload = async (file: File, target: string) => {
    setUploading(target);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-text", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.text) {
        toast.error("Failed to extract text. Try pasting instead.");
        return;
      }
      if (target === "text") setForm((p) => ({ ...p, text: data.text }));
      else if (target === "orig") setForm((p) => ({ ...p, orig: data.text }));
      toast.success("Text extracted");
    } catch {
      toast.error("Failed to extract text. Try pasting instead.");
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.text) return;
    setError("");
    setBusy(true);
    setProgress({ cur: 0, tot: 2, msg: "Extracting clauses..." });

    try {
      const exRes = await fetch("/api/ai/extract-clauses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: form.text }),
      });
      const exData = await exRes.json();
      if (!exRes.ok || !exData.clauses) {
        setError(exData.error || "Failed to extract clauses. Please try again.");
        setBusy(false);
        return;
      }

      let originalClauses = null;
      if ((form.status === "signed-remediated" || form.status === "declined-remediated") && form.orig) {
        setProgress({ cur: 1, tot: 2, msg: "Extracting original clauses..." });
        const origRes = await fetch("/api/ai/extract-clauses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: form.orig }),
        });
        const origData = await origRes.json();
        originalClauses = origData.clauses || null;
      }

      setProgress({ cur: 2, tot: 2, msg: "Saving to library..." });
      const saveRes = await fetch("/api/ndas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          status: form.status,
          rawText: form.text,
          originalRawText: form.orig || null,
          clauses: exData.clauses,
          originalClauses,
        }),
      });

      if (!saveRes.ok) {
        setError("Failed to save NDA. Please try again.");
        toast.error("Failed to save NDA");
        setBusy(false);
        return;
      }

      toast.success("NDA added to library!");
      router.push("/library");
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Something went wrong");
      setBusy(false);
    }
  };

  const isRemediated = form.status === "signed-remediated" || form.status === "declined-remediated";

  if (busy) {
    return (
      <div className="text-center py-16">
        <Loader2 size={32} className="animate-spin mx-auto mb-4 text-[var(--cornerstone-orange)]" />
        <p className="font-medium text-[var(--cornerstone-navy)]">{progress.msg}</p>
        <p className="text-sm text-[var(--muted)] mt-1">Step {progress.cur} of {progress.tot}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl animate-fade-up">
      <h1 className="font-display text-2xl font-bold text-[var(--cornerstone-navy)] mb-6">Add NDA to Library</h1>

      {fromAnalysis && (
        <div className="bg-orange-50 border border-orange-200 text-orange-900 text-sm rounded-md p-3 mb-4">
          Loaded from your analysis. Set the outcome status below (and paste the original draft if it was remediated), then save.
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">{error}</div>}

      <div className="space-y-4">
        <div>
          <Label>NDA Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g., Acme Corp NDA 2025"
            className="mt-1"
          />
        </div>

        <div>
          <Label>Status</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setForm((p) => ({ ...p, status: k }))}
                className={
                  "py-2 px-3 rounded-lg text-sm border transition-all " +
                  (form.status === k
                    ? "bg-[var(--cornerstone-orange)] border-[var(--cornerstone-orange)] text-white"
                    : "bg-white border-[var(--border)] text-[var(--foreground)] hover:border-[var(--cornerstone-orange)]")
                }
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>
            {form.status === "signed-remediated"
              ? "Final Signed Version"
              : form.status === "declined-remediated"
                ? "Last Version Before Declining"
                : "NDA Text"}
          </Label>
          <div className="mt-1">
            <PdfUpload uploading={uploading === "text"} onUpload={(f) => handleUpload(f, "text")} />
          </div>
          <textarea
            value={form.text}
            onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
            rows={8}
            placeholder="Paste the full NDA text here..."
            className="w-full bg-white border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--cornerstone-orange)] resize-none font-mono"
          />
          <CharCount text={form.text} />
        </div>

        {isRemediated && (
          <div>
            <Label>Original Version (before your changes)</Label>
            <div className="mt-1">
              <PdfUpload uploading={uploading === "orig"} onUpload={(f) => handleUpload(f, "orig")} />
            </div>
            <textarea
              value={form.orig}
              onChange={(e) => setForm((p) => ({ ...p, orig: e.target.value }))}
              rows={8}
              placeholder="Paste the original NDA text..."
              className="w-full bg-white border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--cornerstone-orange)] resize-none font-mono"
            />
            <CharCount text={form.orig} />
          </div>
        )}

        <Button onClick={handleSubmit} disabled={!form.name || !form.text} className="w-full">
          Add to Library
        </Button>
      </div>
    </div>
  );
}
