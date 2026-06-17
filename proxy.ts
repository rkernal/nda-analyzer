import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js 16 renamed the "middleware" convention to "proxy". Uses only the
// edge-safe Auth.js config so no Node-only code loads into the edge runtime.
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  // Gate everything except the Auth.js API routes, Next internals, and favicon.
  // The /signin page is allowed through by the `authorized` callback.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
