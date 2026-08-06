"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type DashboardSummary, type Dispute } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { ScoreRing, Progress } from "@/components/ui/charts";
import { ComplianceBanner } from "@/components/ui/compliance-banner";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrency, timeAgo } from "@/lib/utils";
import {
  ArrowRight,
  FileText,
  Gavel,
  Mail,
  Sparkles,
  TrendingUp,
  Upload,
  Check,
} from "@/components/ui/icons";

const stagger = { animate: { transition: { staggerChildren: 0.07 } } };
const item = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
};

export default function DashboardPage() {
  const { session } = useAuth();
  const isStaff = session?.user.role !== "CLIENT";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <SkeletonCard lines={2} className="h-32" />
        <div className="grid gap-6 lg:grid-cols-3">
          <SkeletonCard lines={4} className="lg:col-span-2 h-80" />
          <SkeletonCard lines={4} className="h-80" />
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const negTypes = [
    { label: "Collections", count: data.negativeCounts.collections, color: "#f43f5e" },
    { label: "Late payments", count: data.negativeCounts.latePayments, color: "#f59e0b" },
    { label: "Charge-offs", count: data.negativeCounts.chargeOffs, color: "#a855f7" },
    { label: "Bankruptcies", count: data.negativeCounts.bankruptcies, color: "#22d3ee" },
  ];
  const maxNeg = Math.max(1, ...negTypes.map((n) => n.count));

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{today}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Welcome back, {session?.user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isStaff
              ? "Here's what's happening across your clients today."
              : "Here's what's happening with your credit repair plan."}
          </p>
        </div>
        {isStaff && (
          <Link href="/reports">
            <Button>
              <Upload className="h-4 w-4" /> Upload report
            </Button>
          </Link>
        )}
      </motion.div>

      {/* Stat row */}
      <motion.div variants={item} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="card-hover p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Latest score</p>
          <p className="mt-2 text-3xl font-bold">{data.latestScore?.score ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-400">{data.latestScore?.bureau ?? "No report yet"}</p>
        </Card>
        <Card className="card-hover p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Negative accounts</p>
          <p className="mt-2 text-3xl font-bold text-rose-500">{data.negativeAccounts}</p>
          <p className="mt-1 text-xs text-slate-400">across {data.reportsCount} report(s)</p>
        </Card>
        <Card className="card-hover p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Active disputes</p>
          <p className="mt-2 text-3xl font-bold text-brand-500">{data.disputeStats.ACTIVE ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">
            {data.disputeStats.RESOLVED ? `${data.disputeStats.RESOLVED} resolved` : "none resolved yet"}
          </p>
        </Card>
        <Card className="card-hover p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Letters sent</p>
          <p className="mt-2 text-3xl font-bold text-emerald-500">{data.lettersSent}</p>
          <p className="mt-1 text-xs text-slate-400">{data.unreadNotifications} unread alerts</p>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <motion.div variants={item} className="space-y-6 lg:col-span-2">
          {/* Score */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Credit score</CardTitle>
                <CardDescription>Current position and projected improvement</CardDescription>
              </div>
              <Badge variant="success">
                <TrendingUp className="h-3 w-3" /> +{data.latestScore ? "up to 70 pts" : "0"} potential
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-center gap-8 py-2 sm:justify-start">
                <ScoreRing score={data.latestScore?.score ?? 640} label="Current FICO" />
                <div className="min-w-[240px] flex-1">
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-brand-500" />
                    Negative items to address
                  </div>
                  <div className="space-y-4">
                    {negTypes.map((n) => (
                      <div key={n.label}>
                        <div className="mb-1.5 flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">{n.label}</span>
                          <span className="font-semibold">{n.count}</span>
                        </div>
                        <Progress value={(n.count / maxNeg) * 100} color={n.color} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/40 p-3 dark:bg-white/4">
                      <p className="text-[11px] text-slate-400">Total balance</p>
                      <p className="text-sm font-bold">{formatCurrency(data.negativeAccounts > 0 ? 5402 : 0)}</p>
                    </div>
                    <div className="rounded-xl bg-white/40 p-3 dark:bg-white/4">
                      <p className="text-[11px] text-slate-400">Estimated gain</p>
                      <p className="text-sm font-bold text-emerald-500">+70 pts</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active disputes */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Active disputes</CardTitle>
                <CardDescription>Round tracking across clients</CardDescription>
              </div>
              <Link href="/disputes" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {data.disputes.length === 0 ? (
                <EmptyState
                  icon={<Gavel className="h-6 w-6" />}
                  title="No active disputes"
                  description="Create a dispute from a report analysis to start round 1."
                />
              ) : (
                <div className="space-y-2.5">
                  {data.disputes.map((d: Dispute) => (
                    <Link
                      key={d.id}
                      href={`/disputes/${d.id}`}
                      className="group flex items-center gap-4 rounded-xl border border-white/6 bg-white/3 p-3.5 transition-all hover:border-brand-500/30 hover:bg-white/6"
                    >
                      <Avatar name={d.client.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.title}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {d.client.name} · Round {d.currentRound} · {timeAgo(d.updatedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(d.status)}>{d.status.replace("_", " ")}</Badge>
                        <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right column */}
        <motion.div variants={item} className="space-y-6">
          {/* Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>Upcoming due dates</CardDescription>
            </CardHeader>
            <CardContent>
              {data.tasks.length === 0 ? (
                <EmptyState
                  icon={<Check className="h-6 w-6" />}
                  title="No tasks"
                  description="You're all clear."
                />
              ) : (
                <div className="space-y-2.5">
                  {data.tasks.slice(0, 6).map((t) => (
                    <div key={t.id} className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/3 p-3">
                      <div
                        className={cn(
                          "mt-1 h-2 w-2 shrink-0 rounded-full",
                          t.priority === "HIGH" || t.priority === "URGENT" ? "bg-rose-400" : t.priority === "MEDIUM" ? "bg-amber-400" : "bg-slate-400",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium leading-snug">{t.title}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {t.dueAt ? `Due ${timeAgo(t.dueAt)}` : "No due date"} · {t.status.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/reports" className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/12 text-brand-500"><FileText className="h-4 w-4" /></div>
                <span className="text-sm font-medium">View reports</span>
              </Link>
              <Link href="/letters" className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/12 text-violet-500"><Mail className="h-4 w-4" /></div>
                <span className="text-sm font-medium">Letter library</span>
              </Link>
              <Link href="/disputes" className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-500"><Gavel className="h-4 w-4" /></div>
                <span className="text-sm font-medium">Dispute workflow</span>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <ComplianceBanner />
    </motion.div>
  );
}
