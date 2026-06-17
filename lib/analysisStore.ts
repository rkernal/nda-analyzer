import "server-only";
import { redis } from "./redis";
import { normalizeEmail } from "./users";
import type { Analysis, AnalysisInput, AnalysisSummaryRow } from "@/types";

// Per-user analysis history (PORTING-SPEC §4). Same pattern as ndaStore: JSON
// records + a per-user id set, with an ownership check on every read/delete.

const recordKey = (id: string) => `analysis:${id}`;
const indexKey = (email: string) => `analysis:ids:${normalizeEmail(email)}`;

/** History rows for a user, newest first — omits the heavy `results`/`rawText`. */
export async function listAnalyses(email: string): Promise<AnalysisSummaryRow[]> {
  const ids = await redis.smembers(indexKey(email));
  if (!ids.length) return [];
  const records = await redis.mget<Analysis[]>(...ids.map(recordKey));
  const owner = normalizeEmail(email);
  return records
    .filter((r): r is Analysis => !!r && r.ownerEmail === owner)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ results: _results, rawText: _rawText, ...row }) => row);
}

/** A single analysis, or null if it doesn't exist or isn't owned by this user. */
export async function getAnalysis(email: string, id: string): Promise<Analysis | null> {
  const record = await redis.get<Analysis>(recordKey(id));
  if (!record || record.ownerEmail !== normalizeEmail(email)) return null;
  return record;
}

/** Creates an analysis owned by this user; the store assigns id/ownerEmail/createdAt. */
export async function createAnalysis(email: string, input: AnalysisInput): Promise<Analysis> {
  const owner = normalizeEmail(email);
  const analysis: Analysis = {
    ...input,
    id: crypto.randomUUID(),
    ownerEmail: owner,
    createdAt: new Date().toISOString(),
  };
  await redis.set(recordKey(analysis.id), analysis);
  await redis.sadd(indexKey(owner), analysis.id);
  return analysis;
}

/** Deletes an analysis if owned by this user. Returns false if not found/not owned. */
export async function deleteAnalysis(email: string, id: string): Promise<boolean> {
  const owner = normalizeEmail(email);
  const record = await redis.get<Analysis>(recordKey(id));
  if (!record || record.ownerEmail !== owner) return false;
  await redis.del(recordKey(id));
  await redis.srem(indexKey(owner), id);
  return true;
}

/** Finds a cached analysis by document hash for this user, or null (cost opt #4). */
export async function findAnalysisByHash(email: string, docHash: string): Promise<Analysis | null> {
  const ids = await redis.smembers(indexKey(email));
  if (!ids.length) return null;
  const records = await redis.mget<Analysis[]>(...ids.map(recordKey));
  const owner = normalizeEmail(email);
  return (
    records.find((r): r is Analysis => !!r && r.ownerEmail === owner && r.docHash === docHash) ?? null
  );
}
