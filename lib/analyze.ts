import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL, MODEL_FAST, runStructured } from "./anthropic";
import { STATUS_LABELS } from "./constants";
import {
  classifyMatch,
  deriveVerdict,
  isNearDuplicate,
  rankBySimilarity,
  type ClauseVersion,
  type MatchContributor,
} from "./similarity";
import type { AnalysisResult, AnalysisSummary, Clause, NDA, NDAStatus } from "@/types";

export interface ClauseCandidate {
  text: string;
  title: string;
  clauseType: string;
  ndaName: string;
  ndaStatus: NDAStatus;
  version: ClauseVersion;
}

/** Flatten a user's library into comparable clause candidates (final + original). */
export function buildCandidates(ndas: NDA[]): ClauseCandidate[] {
  const out: ClauseCandidate[] = [];
  for (const nda of ndas) {
    for (const c of nda.clauses ?? []) {
      out.push({ text: c.text, title: c.title, clauseType: c.clauseType || "other", ndaName: nda.name, ndaStatus: nda.status, version: "final" });
    }
    for (const c of nda.originalClauses ?? []) {
      out.push({ text: c.text, title: c.title, clauseType: c.clauseType || "other", ndaName: nda.name, ndaStatus: nda.status, version: "original" });
    }
  }
  return out;
}

// Risk benchmarks for deterministic (exact-match) verdicts — risk is read off
// negotiation history rather than re-scored by the LLM (#3 skips the call).
const DETERMINISTIC_RISK: Record<string, number> = {
  green: 2, yellow: 3, orange: 5, red: 7, conflicted: 7, white: 5,
};

const MATCH_CAP = 800; // trim serialized match text (#5)
// Bump whenever engine logic changes (prompts, ranking, thresholds) so the
// analysis cache (#4) auto-invalidates and re-runs reflect the current code.
export const ENGINE_VERSION = 2;

const WEAK_LEXICAL = 0.5; // top lexical score below this → escalate to semantic rank
const SEMANTIC_POOL_CAP = 40; // candidates fed to the Haiku semantic ranker

const SEMANTIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { topMatches: { type: "array", items: { type: "integer" } } },
  required: ["topMatches"],
} as const;

const DEEP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: ["green", "yellow", "red", "orange", "conflicted", "white"] },
    confidence: { type: "number" },
    explanation: { type: "string" },
    matchedNda: { type: ["string", "null"] },
    matchedClause: { type: ["string", "null"] },
    suggestedAlternative: { type: ["string", "null"] },
    riskScore: { type: "number" },
    riskReasoning: { type: "string" },
    agreedIn: { type: ["string", "null"] },
    declinedIn: { type: ["string", "null"] },
    conflictNote: { type: ["string", "null"] },
  },
  required: ["category", "confidence", "explanation", "riskScore", "riskReasoning"],
} as const;

// A.4 fix 3: grounding line baked into the persona.
const DEEP_SYSTEM =
  "You are a legal NDA analysis assistant. Base every categorization ONLY on the provided library matches. Never invent a match or cite an NDA not listed. Be precise and consistent.";

function statusLabel(s: NDAStatus): string {
  return STATUS_LABELS[s] || s;
}

/**
 * Hybrid recall step (A.3): when lexical similarity is weak, have MODEL_FAST
 * (Haiku) pick the candidates closest in MEANING / legal effect — catches
 * reworded, re-split, or mis-typed matches that token overlap misses. Returns
 * an empty array if Haiku finds nothing reasonably similar.
 */
async function semanticRank(
  client: Anthropic,
  clause: Clause,
  pool: ClauseCandidate[],
  topN: number,
  signal?: AbortSignal,
): Promise<ClauseCandidate[]> {
  if (pool.length <= topN) return pool;
  const condensed = pool
    .map((c, i) => `${i}. [${statusLabel(c.ndaStatus)}] ${c.ndaName} (${c.version}) | ${c.title}: ${c.text.slice(0, 150)}`)
    .join("\n");
  const result = await runStructured<{ topMatches: number[] }>(client, {
    model: MODEL_FAST,
    system:
      "You are a legal-clause similarity ranker. Pick the candidate clauses closest to the TARGET in meaning and legal effect — match by substance, not wording. Return up to 5 candidate indices, most similar first. Return an empty array if none are reasonably similar.",
    content: [
      {
        type: "text",
        text:
          `TARGET CLAUSE:\nTitle: ${clause.title}\nType: ${clause.clauseType || "other"}\nText: ${clause.text}\n\n` +
          `CANDIDATES (index. [status] name (version) | title: preview):\n${condensed}`,
      },
    ],
    toolName: "emit_matches",
    schema: SEMANTIC_SCHEMA as unknown as Anthropic.Tool.InputSchema,
    maxTokens: 200,
    signal,
  });
  const idxs = Array.isArray(result.topMatches) ? result.topMatches : [];
  return idxs
    .filter((i) => Number.isInteger(i) && i >= 0 && i < pool.length)
    .slice(0, topN)
    .map((i) => pool[i]);
}

/**
 * Compare one incoming clause against the library. Tries the deterministic
 * short-circuit first (#3); otherwise locally ranks candidates (#2) and runs
 * the deep-compare pass on MODEL (Sonnet).
 */
export async function compareClause(
  clause: Clause,
  candidates: ClauseCandidate[],
  signal?: AbortSignal,
): Promise<Omit<AnalysisResult, keyof Clause>> {
  const cType = clause.clauseType || "other";
  const sameType = candidates.filter((c) => c.clauseType === cType);
  const pool = sameType.length >= 3 ? sameType : candidates;

  if (pool.length === 0) {
    return {
      category: "white", confidence: 1.0, explanation: "No past NDAs in library to compare against.",
      matchedNda: null, matchedClause: null, suggestedAlternative: null,
      riskScore: 5, riskReasoning: "Unable to benchmark against past agreements.",
      agreedIn: null, declinedIn: null, conflictNote: null,
    };
  }

  // --- Cost opt #3: exact / near-duplicate short-circuit (no LLM call) -----
  const nearMatches = pool.filter((c) => isNearDuplicate(clause.text, c.text));
  if (nearMatches.length) {
    const contributors = nearMatches
      .map((c) => classifyMatch(c.ndaStatus, c.version))
      .filter((c): c is MatchContributor => c !== null);
    const verdict = deriveVerdict(contributors);
    if (verdict) {
      const best = nearMatches[0];
      const agreed = nearMatches.find((c) => classifyMatch(c.ndaStatus, c.version) === "agreed");
      const declined = nearMatches.find((c) => classifyMatch(c.ndaStatus, c.version) === "declined");
      return {
        category: verdict,
        confidence: 1.0,
        explanation: `Exact/near-identical match to language in "${best.ndaName}" (${statusLabel(best.ndaStatus)}). Verdict derived from your negotiation history.`,
        matchedNda: best.ndaName,
        matchedClause: best.text.slice(0, MATCH_CAP),
        suggestedAlternative: null,
        riskScore: DETERMINISTIC_RISK[verdict] ?? 5,
        riskReasoning: "Risk benchmarked from a previously seen clause rather than re-scored.",
        agreedIn: verdict === "conflicted" ? agreed?.ndaName ?? null : null,
        declinedIn: verdict === "conflicted" ? declined?.ndaName ?? null : null,
        conflictNote:
          verdict === "conflicted"
            ? "This language appears in both a signed and a declined NDA — you have been inconsistent here."
            : null,
      };
    }
  }

  // --- Cost opt #2 + hybrid semantic ranker: pick the top-5 candidates. ---
  // Lexical rank first. If the best lexical match is weak (a reworded / re-split
  // / mis-typed clause), escalate to a cheap Haiku semantic re-rank over ALL
  // candidates (not just same-type) — this is the recall fix for false
  // "new language" verdicts (PORTING-SPEC A.3).
  const client = getClient();
  const lexTop = rankBySimilarity(clause.text, pool, (c) => c.text, 5);
  const bestScore = lexTop[0]?.score ?? 0;

  let shortlist: ClauseCandidate[];
  if (client && bestScore < WEAK_LEXICAL) {
    const coarse = rankBySimilarity(clause.text, candidates, (c) => c.text, SEMANTIC_POOL_CAP).map((r) => r.item);
    const semantic = await semanticRank(client, clause, coarse, 5, signal).catch(() => null);
    shortlist = semantic && semantic.length ? semantic : lexTop.map((r) => r.item);
  } else {
    shortlist = lexTop.map((r) => r.item);
  }

  // #5: dedup near-identical candidates before serializing context.
  const topCandidates: ClauseCandidate[] = [];
  for (const c of shortlist) {
    if (!topCandidates.some((t) => isNearDuplicate(t.text, c.text))) topCandidates.push(c);
  }

  if (!client) return stubCompare(topCandidates);

  // --- A.0 FIX: hyphenated status values (was underscored → orange/red dead) ---
  const hasDeclined = topCandidates.some((c) => c.ndaStatus === "declined" || c.ndaStatus === "declined-remediated");
  const hasRemediated = topCandidates.some((c) => c.ndaStatus === "signed-remediated" && c.version === "original");

  const detailedCtx = topCandidates
    .map(
      (c, i) =>
        `${i + 1}. NDA: "${c.ndaName}" [${statusLabel(c.ndaStatus)}] (${c.version} version)\n   Type: ${c.clauseType}\n   Title: ${c.title}\n   Full text: ${c.text.slice(0, MATCH_CAP)}`,
    )
    .join("\n\n");
  const statusesPresent = Array.from(new Set(topCandidates.map((c) => statusLabel(c.ndaStatus))));

  // Deep-compare prompt — ported verbatim with the three A.4 surgical fixes
  // (tightened red rule, defined confidence) and the FIXED dynamic guardrails.
  const prompt =
    `Compare this clause against the top matching clauses from my NDA library. Categorize it and assess legal risk.\n\n` +
    `CLAUSE TO ANALYZE:\nTitle: ${clause.title}\nType: ${cType}\nText: ${clause.text}\n\n` +
    `TOP MATCHING CLAUSES FROM MY LIBRARY:\n${detailedCtx}\n\n` +
    `STATUSES ACTUALLY PRESENT IN THESE MATCHES: ${statusesPresent.join(", ")}\n` +
    (!hasDeclined
      ? `\n⚠️ CRITICAL: There are NO declined NDAs in these matches. You MUST NOT use category "red" or "conflicted" — those require evidence from a declined NDA. If a clause seems aggressive, reflect that in a higher riskScore, NOT in the category.\n`
      : "") +
    (!hasRemediated
      ? `\n⚠️ CRITICAL: There are NO remediated NDAs (with original versions) in these matches. You MUST NOT use category "orange" — that requires evidence that I negotiated this language away in a past NDA.\n`
      : "") +
    `\nCATEGORIZATION RULES (follow strictly):\n` +
    `- "green": Nearly identical to language ONLY found in previously SIGNED NDAs (as-is or final remediated). No matching declined NDAs.\n` +
    `- "yellow": Similar to past NDAs but with notable differences. No direct conflict.\n` +
    `- "red": Matches language ONLY found in previously DECLINED NDAs, declined-remediated NDAs (both the original and the last version before walking away), or originals from a DECLINED negotiation. Not present in any signed NDA.\n` +
    `- "orange": Contains language I've successfully remediated before (appeared in the original, changed in the final of a SIGNED-remediated NDA). Rule of thumb: original-draft language is orange if it came from something ultimately SIGNED, red if from something DECLINED.\n` +
    `- "conflicted": CRITICAL — Use this when the clause matches or closely resembles language found in BOTH a signed NDA AND a declined/declined-remediated NDA. This means I have been inconsistent with this language. You MUST check all provided matches before choosing a category.\n` +
    `- "white": Entirely new language not found in any past NDA.\n\n` +
    `IMPORTANT STATUS CONTEXT:\n` +
    `- Signed (As-Is): I agreed to all language as-is\n` +
    `- Signed (Remediated): I negotiated changes and then signed. The "original" was unacceptable, the "final" is what I agreed to.\n` +
    `- Declined: I rejected the entire NDA without negotiation\n` +
    `- Declined (Remediated): I attempted negotiation but ultimately walked away. BOTH the original AND the last version represent language I found unacceptable.\n\n` +
    `PRIORITY: If there is ANY match in both a signed and declined/remediated-original NDA, you MUST use "conflicted".\n\n` +
    `For "conflicted" results, provide agreedIn, declinedIn, and conflictNote.\n\n` +
    `Provide riskScore 1-10 based on how aggressive/unusual the clause is LEGALLY (scope breadth, duration, one-sidedness, ambiguity, penalty severity, jurisdiction issues, deviation from standard norms). 1=standard/benign, 10=extremely aggressive. Provide riskReasoning explaining specific factors driving the score.\n\n` +
    `confidence = how closely the matched library language aligns; 1.0 = near-identical match, lower = looser or inferred.\n\n` +
    `Provide suggestedAlternative (language you accepted elsewhere) for orange, red, or conflicted clauses where you know one; otherwise null.`;

  const result = await runStructured<AnalysisResult>(client, {
    model: MODEL,
    system: DEEP_SYSTEM,
    content: [{ type: "text", text: prompt }],
    toolName: "emit_analysis",
    schema: DEEP_SCHEMA as unknown as Anthropic.Tool.InputSchema,
    maxTokens: 2000,
    signal,
  });

  // Defend against an out-of-enum category.
  const valid = ["green", "yellow", "red", "orange", "conflicted", "white"];
  if (!valid.includes(result.category)) result.category = "white";
  return result;
}

// Offline fallback for the deep-compare pass (no API key).
function stubCompare(top: ClauseCandidate[]): Omit<AnalysisResult, keyof Clause> {
  const best = top[0];
  return {
    category: "yellow", confidence: 0.4,
    explanation: `[stub — set ANTHROPIC_API_KEY for real analysis] Closest library clause: ${best ? `"${best.ndaName}"` : "none"}.`,
    matchedNda: best?.ndaName ?? null, matchedClause: best?.text.slice(0, MATCH_CAP) ?? null,
    suggestedAlternative: null, riskScore: 5, riskReasoning: "Stub mode — no model scoring.",
    agreedIn: null, declinedIn: null, conflictNote: null,
  };
}

/** Roll clause results up into the summary + headline metrics (Appendix B math). */
export function computeSummary(results: AnalysisResult[]): {
  summary: AnalysisSummary;
  familiarityPct: number;
  avgRiskScore: number;
  maxRiskScore: number;
} {
  const summary: AnalysisSummary = { green: 0, yellow: 0, red: 0, orange: 0, conflicted: 0, white: 0 };
  for (const r of results) {
    if (summary[r.category] !== undefined) summary[r.category]++;
  }
  const n = results.length;
  const scores = results.filter((r) => r.riskScore).map((r) => r.riskScore);
  const familiarityPct = n > 0 ? ((summary.green + summary.yellow * 0.5) / n) * 100 : 0;
  const avgRiskScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
  const maxRiskScore = scores.length ? Math.max(...scores) : 0;
  return { summary, familiarityPct, avgRiskScore, maxRiskScore };
}
