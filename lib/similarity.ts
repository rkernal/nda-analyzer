import "server-only";
import { createHash } from "crypto";
import type { NDAStatus } from "@/types";

// Local similarity + hashing helpers powering three cost optimizations:
//   #2 local candidate shortlisting (rankBySimilarity) — removes the rank LLM call
//   #3 exact/near-duplicate short-circuit (isNearDuplicate + deriveVerdict)
//   #4 analysis cache by document hash (docHash)
// deriveVerdict MUST use the same HYPHENATED status values the deep-compare
// guardrails use (PORTING-SPEC A.0) so deterministic verdicts agree with the LLM.

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** Token-set Jaccard overlap (0–1). Good proxy for lexical overlap. */
export function jaccard(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

/** Term-frequency cosine similarity (0–1). Captures repeated-term emphasis. */
export function cosine(a: string, b: string): number {
  const ta = termFreq(tokenize(a));
  const tb = termFreq(tokenize(b));
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, c] of ta) {
    na += c * c;
    const o = tb.get(t);
    if (o) dot += c * o;
  }
  for (const [, c] of tb) nb += c * c;
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Blended lexical score used for candidate ranking. */
export function similarity(a: string, b: string): number {
  return 0.5 * jaccard(a, b) + 0.5 * cosine(a, b);
}

/**
 * Cost opt #2: rank candidate clauses against a target by lexical similarity
 * and return the top N. Callers should pre-filter by clauseType first.
 */
export function rankBySimilarity<T>(
  target: string,
  candidates: T[],
  getText: (c: T) => string,
  topN = 5,
): { item: T; score: number }[] {
  return candidates
    .map((item) => ({ item, score: similarity(target, getText(item)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Cost opt #3: is `a` an exact or near-exact (≥ threshold lexical overlap) copy
 * of `b`? On a hit we can derive the verdict deterministically and skip Claude.
 */
export function isNearDuplicate(a: string, b: string, threshold = 0.95): boolean {
  if (normalize(a) === normalize(b)) return true;
  return jaccard(a, b) >= threshold;
}

// ---- Deterministic verdict (cost opt #3) --------------------------------

/** Which version of a library NDA a clause came from. */
export type ClauseVersion = "final" | "original";

/** What a single matched library clause contributes to the verdict. */
export type MatchContributor = "agreed" | "declined" | "remediated-original";

/**
 * Classify one exact/near match by the matched NDA's status + which version the
 * clause came from. Mirrors the deep-compare category rules (A.4):
 *   - language that ended up in a SIGNED agreement → "agreed" (green)
 *   - language from a DECLINED negotiation (any version) → "declined" (red)
 *   - original-draft language negotiated away in a SIGNED deal → "remediated-original" (orange)
 * Returns null when the (status, version) pair has no deterministic meaning.
 */
export function classifyMatch(status: NDAStatus, version: ClauseVersion): MatchContributor | null {
  switch (status) {
    case "signed-asis":
      return "agreed";
    case "signed-remediated":
      // final = the signed language (agreed); original = the draft negotiated away.
      return version === "final" ? "agreed" : "remediated-original";
    case "declined":
      return "declined";
    case "declined-remediated":
      // both the original and the last version before walking away are "declined".
      return "declined";
    default:
      return null;
  }
}

/**
 * Combine the contributors of all matches into a single category, or null when
 * the evidence is ambiguous (let the LLM decide). Conflicted requires BOTH
 * agreed-final and declined evidence (the conflicted-priority rule).
 */
export function deriveVerdict(contributors: MatchContributor[]): string | null {
  if (!contributors.length) return null;
  const hasAgreed = contributors.includes("agreed");
  const hasDeclined = contributors.includes("declined");
  const hasRemediated = contributors.includes("remediated-original");

  if (hasAgreed && hasDeclined) return "conflicted";
  if (hasAgreed) return "green"; // agreed wins over a stray remediated-original
  if (hasDeclined) return "red";
  if (hasRemediated) return "orange";
  return null;
}

// ---- Hashing (cost opt #4) ----------------------------------------------

/** Stable hash of a document's normalized text. */
export function hashText(text: string): string {
  return createHash("sha256").update(normalize(text)).digest("hex");
}

/** Fingerprint of the library so the cache invalidates when the library changes. */
export function libraryFingerprint(ndas: { id: string; dateAdded: string }[]): string {
  return ndas
    .map((n) => `${n.id}:${n.dateAdded}`)
    .sort()
    .join("|");
}

/** Combined cache key: document text + library fingerprint. */
export function docHash(text: string, fingerprint: string): string {
  return createHash("sha256")
    .update(normalize(text) + "||" + fingerprint)
    .digest("hex");
}
