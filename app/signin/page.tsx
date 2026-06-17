import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign in — NDA Analyzer" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  async function doSignIn(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/",
      });
    } catch (err) {
      if (err instanceof AuthError) redirect("/signin?error=1");
      throw err; // let NEXT_REDIRECT propagate
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="card w-full max-w-sm p-8">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--cornerstone-orange)]" />
          Cornerstone Engineering
        </div>
        <h1 className="font-display mt-2 text-2xl font-bold text-[var(--cornerstone-navy)]">NDA Analyzer</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Sign in with your Cornerstone tools credentials.</p>

        {params.error ? (
          <div className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">Incorrect email or password.</div>
        ) : null}

        <form action={doSignIn} className="mt-6 flex flex-col gap-3">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email"
            placeholder="you@cornerstoneeng.com" className="field !mt-0" />
          <label className="label mt-2" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="field !mt-0" />
          <button type="submit" className="btn-primary mt-4">Sign in</button>
        </form>

        <p className="mt-6 text-xs text-[var(--muted)]">Forgot your password? Reset it in the Sandbox.</p>
      </div>
    </main>
  );
}
