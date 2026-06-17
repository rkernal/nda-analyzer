"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Shield, BookOpen, FileSearch, History, BarChart3, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: Shield },
  { href: "/library", label: "NDA Library", icon: BookOpen },
  { href: "/analyze", label: "Analyze NDA", icon: FileSearch },
  { href: "/history", label: "Past Analyses", icon: History },
  { href: "/playbook", label: "Playbook", icon: BarChart3 },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-white border border-[var(--border)] p-2 rounded-md text-[var(--cornerstone-navy)] shadow-sm"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-[var(--border)] transform transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-auto",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-[var(--border)]">
            <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
              <Shield className="h-8 w-8 text-[var(--cornerstone-orange)]" />
              <span className="font-display text-xl font-bold text-[var(--cornerstone-navy)]">NDA Analyzer</span>
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-orange-50 text-[var(--cornerstone-orange)]"
                      : "text-[var(--muted)] hover:bg-stone-100 hover:text-[var(--cornerstone-navy)]",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div className="text-sm min-w-0">
                <p className="text-[var(--foreground)] font-medium truncate">{email}</p>
                <p className="text-[var(--muted)] text-xs">Cornerstone tools</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="text-[var(--muted)] hover:text-[var(--cornerstone-navy)] transition-colors shrink-0"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
