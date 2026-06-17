import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { listNdas } from "@/lib/ndaStore";
import { createAnalysis, findAnalysisByHash } from "@/lib/analysisStore";
import { buildCandidates, compareClause, computeSummary } from "@/lib/analyze";
import { extractClauses } from "@/lib/extractClauses";
import { docHash, libraryFingerprint } from "@/lib/similarity";
import type { AnalysisResult } from "@/types";

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, text } = body;
  if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  const ndas = await listNdas(email);
  if (ndas.length === 0) {
    return NextResponse.json({ error: "Add at least one NDA to your library first" }, { status: 400 });
  }

  const candidates = buildCandidates(ndas);
  // Cost opt #4: cache key = normalized doc text + library fingerprint.
  const hash = docHash(text, libraryFingerprint(ndas.map((n) => ({ id: n.id, dateAdded: n.dateAdded }))));

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  req.signal.addEventListener("abort", () => abortController.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(data)));
        } catch {
          // stream already closed
        }
      };

      try {
        // Cost opt #4: short-circuit on a cache hit.
        const cached = await findAnalysisByHash(email, hash);
        if (cached) {
          send({ progress: { cur: 1, tot: 1, msg: "Found a cached analysis for this document..." } });
          send({ analysisId: cached.id, complete: true });
          return;
        }

        // Step 1: extract clauses (MODEL_FAST).
        send({ progress: { cur: 0, tot: 1, msg: "Extracting clauses from NDA..." } });
        let clauses;
        try {
          clauses = await extractClauses(text);
        } catch (e) {
          if (abortController.signal.aborted) return void send({ error: "Analysis cancelled." });
          return void send({ error: `Failed to extract clauses: ${e instanceof Error ? e.message : "Unknown error"}` });
        }

        if (!clauses.length) {
          return void send({ error: "Could not extract any clauses from the provided text. Please check that you pasted a valid NDA." });
        }

        const total = clauses.length;
        send({ progress: { cur: 0, tot: total, msg: `Found ${total} clauses. Starting comparison...` } });

        // Step 2: compare each clause (deterministic short-circuit, else MODEL).
        const results: AnalysisResult[] = [];
        for (let i = 0; i < total; i++) {
          if (abortController.signal.aborted) return void send({ error: "Analysis cancelled." });
          const clause = clauses[i];
          send({ progress: { cur: i, tot: total, msg: `Analyzing clause ${i + 1} of ${total}: "${clause.title}"` } });

          let comparison;
          try {
            comparison = await compareClause(clause, candidates, abortController.signal);
          } catch (e) {
            if (abortController.signal.aborted) return void send({ error: "Analysis cancelled." });
            console.error(`Clause ${i + 1} comparison failed:`, e);
            comparison = {
              category: "white", explanation: "Analysis for this clause failed — marked as new language.",
              confidence: 0, riskScore: 5, riskReasoning: "Unable to assess due to an error during comparison.",
              matchedNda: null, matchedClause: null, suggestedAlternative: null,
              agreedIn: null, declinedIn: null, conflictNote: null,
            };
          }
          results.push({ ...clause, ...comparison });
        }

        // Step 3: summary.
        send({ progress: { cur: total, tot: total, msg: "Calculating results..." } });
        const { summary, familiarityPct, avgRiskScore, maxRiskScore } = computeSummary(results);

        // Step 4: save.
        send({ progress: { cur: total, tot: total, msg: "Saving results..." } });
        const analysis = await createAnalysis(email, {
          ndaName: name || "Untitled NDA",
          rawText: text,
          summary,
          results,
          familiarityPct,
          avgRiskScore,
          maxRiskScore,
          libSnapshot: { ndaCount: ndas.length, clauseCount: candidates.length },
          docHash: hash,
        });

        // Step 5: done.
        send({ analysisId: analysis.id, complete: true });
      } catch (e) {
        console.error("Analysis stream error:", e);
        send({ error: e instanceof Error ? e.message : "An unexpected error occurred during analysis." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
