import Link from "next/link";
import { BookOpen, FileSearch, History, BarChart3 } from "lucide-react";

const menuItems = [
  { href: "/library", icon: BookOpen, title: "NDA Library", description: "View and manage your NDA collection" },
  { href: "/analyze", icon: FileSearch, title: "Analyze NDA", description: "Compare a new NDA against your library" },
  { href: "/history", icon: History, title: "Past Analyses", description: "Review previous analysis results" },
  { href: "/playbook", icon: BarChart3, title: "Negotiation Playbook", description: "Your negotiation patterns and stats" },
];

export default function DashboardPage() {
  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-[var(--cornerstone-navy)]">NDA Analyzer</h1>
        <p className="text-[var(--muted)] mt-1">What would you like to do today?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} className="card flex items-start gap-4 p-6 transition-colors hover:bg-stone-50">
            <div className="bg-[var(--cornerstone-navy)] p-3 rounded-lg">
              <item.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--cornerstone-navy)]">{item.title}</h2>
              <p className="text-sm text-[var(--muted)] mt-1">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <footer className="mt-12 text-center text-[var(--muted)] text-xs">
        Not legal advice. For informational purposes only.
      </footer>
    </div>
  );
}
