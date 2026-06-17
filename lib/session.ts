import "server-only";
import { auth } from "@/auth";

/**
 * The signed-in supervisor's email — the identity key everywhere (replaces the
 * original's getSessionUser()/Postgres user id). Stores normalize it themselves.
 */
export async function getSessionEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}
