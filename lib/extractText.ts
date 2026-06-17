import "server-only";
import mammoth from "mammoth";
import { getClient, MODEL_FAST } from "./anthropic";

// Cost opt #1: parse PDF + DOCX LOCALLY. Claude is only a fallback for scanned/
// image PDFs whose text layer is empty — DOCX never needs Claude. Replaces the
// original api/ai/extract-text route, which base64'd the whole PDF into a Claude
// `document` call every time.

export type FileKind = "pdf" | "docx";

export interface ExtractResult {
  text: string;
  /** True when we fell back to Claude vision (scanned PDF with no text layer). */
  usedClaudeFallback: boolean;
}

/** Decide PDF vs DOCX from the mime type, falling back to the filename. */
export function detectKind(mime?: string, filename?: string): FileKind | null {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("word") || m.includes("officedocument.wordprocessingml")) return "docx";
  const name = (filename ?? "").toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx") || name.endsWith(".doc")) return "docx";
  return null;
}

/** Extract text from an uploaded PDF or DOCX buffer. */
export async function extractText(
  buffer: Buffer,
  opts: { mime?: string; filename?: string } = {},
): Promise<ExtractResult> {
  const kind = detectKind(opts.mime, opts.filename);
  if (kind === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return { text: value.trim(), usedClaudeFallback: false };
  }
  if (kind === "pdf") {
    const local = await extractPdfLocally(buffer);
    // A real (non-scanned) NDA has a substantial text layer; a near-empty result
    // means an image/scanned PDF → fall back to Claude vision.
    if (local.replace(/\s/g, "").length >= 50) {
      return { text: local.trim(), usedClaudeFallback: false };
    }
    const ocr = await extractPdfWithClaude(buffer);
    return { text: ocr.trim(), usedClaudeFallback: true };
  }
  throw new Error("Unsupported file type — upload a PDF or Word (.docx) document.");
}

async function extractPdfLocally(buffer: Buffer): Promise<string> {
  // unpdf bundles a serverless build of pdf.js — no worker/binary setup needed.
  const { getDocumentProxy, extractText: unpdfExtract } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await unpdfExtract(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

async function extractPdfWithClaude(buffer: Buffer): Promise<string> {
  const client = getClient();
  if (!client) {
    throw new Error(
      "This PDF has no extractable text layer (likely scanned). Set ANTHROPIC_API_KEY to enable OCR, or paste the text directly.",
    );
  }
  const response = await client.messages.create({
    model: MODEL_FAST,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
          },
          {
            type: "text",
            text: "Extract all text from this document verbatim, preserving clause and paragraph structure. Return only the document text, with no commentary.",
          },
        ],
      },
    ],
  });
  return response.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
}
