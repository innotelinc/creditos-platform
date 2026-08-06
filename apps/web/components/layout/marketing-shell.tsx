"use client";

import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/knowledge-base", label: "Help center" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-bg min-h-screen text-slate-900 dark:text-slate-100">
      <header className="glass-strong sticky top-0 z-40 border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/"><Logo /></Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="transition-colors hover:text-slate-900 dark:hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link href="/register"><Button size="sm">Start free</Button></Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <Logo size="sm" />
          <p className="max-w-xl text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">
            CreditOS is a documentation, letter-generation and dispute-tracking platform. It is not a law firm,
            is not a credit bureau, and does not provide legal advice. Credit outcomes are not guaranteed.
            15 U.S.C. § 1679c: consumers may dispute information directly with the bureaus at no cost.
          </p>
          <div className="flex items-center gap-6 text-xs font-medium text-slate-400">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-slate-600 dark:hover:text-slate-200">{n.label}</Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
