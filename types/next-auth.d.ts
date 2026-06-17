import type { DefaultSession, DefaultUser } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";

// Mirrors the Sandbox's `mustChangePassword` claim so the shared user records
// type-check identically (the tool doesn't gate on it, but keeps the shape).

declare module "next-auth" {
  interface User extends DefaultUser {
    mustChangePassword?: boolean;
  }
  interface Session {
    user: {
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    mustChangePassword?: boolean;
  }
}
