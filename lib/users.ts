import bcrypt from "bcryptjs";
import { redis } from "./redis";

// Read-only view of the Sandbox's user store — this tool only needs to verify
// credentials at sign-in. Account creation / reset / change-password all live
// in the Sandbox (same Redis), so they're intentionally absent here.

export type UserRecord = {
  email: string; // canonical (lowercase)
  passwordHash: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function key(email: string): string {
  return `user:${normalizeEmail(email)}`;
}

export async function getUser(email: string): Promise<UserRecord | null> {
  const record = await redis.get<UserRecord>(key(email));
  return record ?? null;
}

/** Verifies an email + password pair against the stored hash. */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<UserRecord | null> {
  const user = await getUser(email);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}
