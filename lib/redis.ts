import { Redis } from "@upstash/redis";

// Shared Upstash Redis client. Point this at the SAME Upstash database as the
// Sandbox (same UPSTASH_REDIS_REST_URL/TOKEN) so sign-in reads the same user
// records — supervisors use one set of credentials across tools. This tool's
// own NDA + analysis records live under their own key prefixes (see lib/ndaStore,
// lib/analysisStore).
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
