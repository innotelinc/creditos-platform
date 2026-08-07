"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Spinner, Button } from "@/components/ui/button";
import { useAuth, useRole } from "@/lib/auth";
import { api, type BillingStatus } from "@/lib/api";
import { CreditCard, Lock } from "@/components/ui/icons";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const { isClient, isConsumer } = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const { data: billing } = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => api.get<BillingStatus>("/billing/status"),
    enabled: !!session,
    retry: false,
    refetchInterval: 60_000,
  });

  const blocked = billing?.blocked ?? false;

  React.useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
      return;
    }
    // Blocked (no active plan): staff/admins and self-signup consumers are
    // routed to the billing paywall — consumers can buy Credit Monitoring
    // themselves; agency-managed client users get a lock screen instead.
    if (blocked && pathname !== "/billing" && (!isClient || isConsumer)) {
      router.replace("/billing");
    }
  }, [loading, session, blocked, isClient, isConsumer, pathname, router]);

  if (loading || !session) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-8 w-8 text-brand-500" />
          <p className="text-sm text-slate-400">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  // Client lock screen — agency-managed clients can't subscribe themselves; the
  // workspace admin restores access. Self-signup consumers are routed to /billing.
  if (blocked && isClient && !isConsumer) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/8 bg-white/4 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-500">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Workspace access paused</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Your workspace doesn&apos;t have an active plan. Contact your workspace administrator
            to choose a plan and restore access to reports, disputes and letters.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/pricing?model=consumer" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
              View services
            </Link>
            <button
              onClick={() => void router.replace("/login")}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admins redirected to /billing — show a transient loading state until the
  // redirect lands so we never flash the blocked page's contents.
  if (blocked && pathname !== "/billing") {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
