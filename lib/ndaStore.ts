import "server-only";
import { redis } from "./redis";
import { normalizeEmail } from "./users";
import type { NDA, NDAInput } from "@/types";

// Per-user private NDA library (PORTING-SPEC §4). Records are stored as JSON;
// a per-user Redis set indexes the ids. Every read/delete verifies ownership
// against the session email before returning/acting — this replaces Prisma's
// `where: { userId }` scoping and is what keeps libraries private.

const recordKey = (id: string) => `nda:${id}`;
const indexKey = (email: string) => `nda:ids:${normalizeEmail(email)}`;

/** All of a user's NDAs, newest first. */
export async function listNdas(email: string): Promise<NDA[]> {
  const ids = await redis.smembers(indexKey(email));
  if (!ids.length) return [];
  const records = await redis.mget<NDA[]>(...ids.map(recordKey));
  const owner = normalizeEmail(email);
  return records
    .filter((r): r is NDA => !!r && r.ownerEmail === owner)
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
}

/** A single NDA, or null if it doesn't exist or isn't owned by this user. */
export async function getNda(email: string, id: string): Promise<NDA | null> {
  const record = await redis.get<NDA>(recordKey(id));
  if (!record || record.ownerEmail !== normalizeEmail(email)) return null;
  return record;
}

/** Creates an NDA owned by this user; the store assigns id/ownerEmail/dateAdded. */
export async function createNda(email: string, input: NDAInput): Promise<NDA> {
  const owner = normalizeEmail(email);
  const nda: NDA = {
    ...input,
    id: crypto.randomUUID(),
    ownerEmail: owner,
    dateAdded: new Date().toISOString(),
  };
  await redis.set(recordKey(nda.id), nda);
  await redis.sadd(indexKey(owner), nda.id);
  return nda;
}

/** Deletes an NDA if owned by this user. Returns false if not found/not owned. */
export async function deleteNda(email: string, id: string): Promise<boolean> {
  const owner = normalizeEmail(email);
  const record = await redis.get<NDA>(recordKey(id));
  if (!record || record.ownerEmail !== owner) return false;
  await redis.del(recordKey(id));
  await redis.srem(indexKey(owner), id);
  return true;
}
