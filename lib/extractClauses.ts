import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL_FAST, runStructured } from "./anthropic";
import type { Clause } from "@/types";

// Clause extraction (PORTING-SPEC A.2). Runs on MODEL_FAST (Haiku) — it's a
// strict structured-extraction task. Forced tool use guarantees the JSON shape
// (A.1.1); long NDAs are chunked rather than truncated at 8 000 chars (#5).

const CLAUSE_TYPE_ENUM = [
  "non-compete", "non-solicit", "confidentiality", "term-duration", "governing-law",
  "remedies", "definition", "scope", "exclusions", "ip-ownership", "indemnification",
  "termination", "dispute-resolution", "injunctive-relief", "return-of-materials",
  "assignment", "severability", "other",
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    clauses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", description: "Short descriptive title." },
          text: { type: "string", description: "The clause text, copied verbatim." },
          clauseType: { type: "string", enum: CLAUSE_TYPE_ENUM },
        },
        required: ["title", "text", "clauseType"],
      },
    },
  },
  required: ["clauses"],
} as const;

// Improved extraction prompt (A.2): verbatim copy, negotiable-provision
// granularity, and a non-NDA escape hatch.
const PROMPT = `Extract every distinct operative clause/provision from this NDA. Copy each clause's text verbatim — do not paraphrase, summarize, or fix typos. Split at the level of individually negotiable provisions: one numbered section or sub-section with a distinct legal effect = one clause. Do not merge unrelated provisions, and do not split a single provision mid-sentence. Give each a short descriptive title and classify its type (pick the single dominant type if several apply).

Clause types: non-compete, non-solicit, confidentiality, term-duration, governing-law, remedies, definition, scope, exclusions, ip-ownership, indemnification, termination, dispute-resolution, injunctive-relief, return-of-materials, assignment, severability, other

If the text is not an NDA or has no recognizable clauses, return an empty list.

NDA TEXT:
`;

// Chunk long documents on paragraph boundaries so no tail clauses are lost.
// ~14k chars/chunk keeps each well within MODEL_FAST's window with headroom.
const CHUNK_CHARS = 14000;

function chunk(text: string): string[] {
  if (text.length <= CHUNK_CHARS) return [text];
  const paras = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > CHUNK_CHARS) {
      chunks.push(cur);
      cur = "";
    }
    // A single oversized paragraph still has to go somewhere — push it whole.
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** Extract clauses from NDA text. Returns [] for non-NDA / empty input. */
export async function extractClauses(text: string): Promise<Clause[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const client = getClient();
  if (!client) return stubClauses(trimmed);

  const chunks = chunk(trimmed);
  const all: Clause[] = [];
  for (const c of chunks) {
    const result = await runStructured<{ clauses: Clause[] }>(client, {
      model: MODEL_FAST,
      content: [{ type: "text", text: PROMPT + c }],
      toolName: "emit_clauses",
      schema: SCHEMA as unknown as Anthropic.Tool.InputSchema,
      maxTokens: 8000,
    });
    if (Array.isArray(result.clauses)) all.push(...result.clauses);
  }
  return all;
}

// Naive offline fallback so the flow runs end-to-end without an API key.
function stubClauses(text: string): Clause[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40)
    .slice(0, 20)
    .map((p, i) => ({
      title: `Clause ${i + 1} [stub]`,
      text: p,
      clauseType: "other",
    }));
}
