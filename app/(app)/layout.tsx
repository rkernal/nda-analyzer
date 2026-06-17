import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/app/Sidebar";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";

// Shell for all authenticated tool pages. The proxy already gates these routes;
// this server layout reads the session and hands the email to the client
// sidebar (PORTING-SPEC §6 — server layout + small client signOut).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin");

  return (
    <div className="min-h-screen flex">
      <Sidebar email={email} />
      <main className="flex-1">
        <div className="p-4 pt-16 lg:pt-8 lg:p-8 max-w-5xl mx-auto">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
