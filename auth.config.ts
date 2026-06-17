import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

/**
 * Edge-safe Auth.js config — no providers / Node-only deps, so the proxy
 * (edge runtime) can import it. The full config in `auth.ts` adds Credentials.
 *
 * Unlike the Sandbox, this tool does NOT force the first-login change-password
 * flow — supervisors rotate their password in the Sandbox; here we only gate
 * on whether they're signed in.
 */
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/signin", error: "/signin" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;

      if (pathname.startsWith("/signin")) {
        if (isLoggedIn) return NextResponse.redirect(new URL("/", request.nextUrl));
        return true;
      }
      return isLoggedIn; // false → Auth.js redirects to /signin
    },
    async jwt({ token, user }) {
      if (user) token.email = user.email ?? null;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.email = (token.email as string) ?? session.user.email;
      return session;
    },
  },
};
