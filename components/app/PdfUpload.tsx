"use client";

import { Upload } from "lucide-react";

interface PdfUploadProps {
  uploading: boolean;
  onUpload: (file: File) => void;
}

// Accepts PDF or DOCX (cost opt #1 parses both locally). Label updated to match.
export function PdfUpload({ uploading, onUpload }: PdfUploadProps) {
  return (
    <div className="flex gap-2 mb-2">
      <label
        className={
          "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed cursor-pointer transition-all " +
          (uploading
            ? "border-[var(--cornerstone-orange)] bg-orange-50"
            : "border-[var(--border)] hover:border-[var(--cornerstone-orange)] hover:bg-stone-100")
        }
      >
        <Upload size={16} className="text-[var(--cornerstone-orange)]" />
        <span className="text-sm text-[var(--foreground)]">
          {uploading ? "Extracting text..." : "Upload PDF or Word"}
        </span>
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
          }}
          disabled={uploading}
        />
      </label>
      <span className="self-center text-xs text-[var(--muted)]">or paste below</span>
    </div>
  );
}

export function CharCount({ text }: { text: string }) {
  if (!text) return null;
  return <p className="text-xs text-[var(--muted)] mt-1">{text.length.toLocaleString()} characters loaded</p>;
}
