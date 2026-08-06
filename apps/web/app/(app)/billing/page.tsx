"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type BillingSummary, type Plan, type PricingCatalog } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { CreditCard, Check, Sparkles, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "success",
  TRIALING: "info",
  PAST_DUE: "warning",
  CANCELED: "neutral",
};

export default function BillingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: () => api.get<BillingSummary>("/billing/summary"),
  });
  const { data: catalog } = useQuery({
    queryKey: ["pricing"],
    queryFn: () => api.get<PricingCatalog>("/pricing/public"),
  });

  const checkout = useMutation({
    mutationFn: (planCode: string) => api.post<{ success: boolean; invoice: { number: string } }>("/billing/checkout", { planCode }),
    onSuccess: (res, planCode) => {
      toast({ type: "success", title: "Plan updated", description: `Invoice ${res.invoice?.number ?? ""} issued.` });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["pricing"] });
    },
    onError: (err: Error) => toast({ type: "error", title: "Checkout failed", description: err.message }),
  });

  const cancel = useMutation({
    mutationFn: () => api.post<{ success: boolean }>("/billing/cancel", {}),
    onSuccess: () => {
      toast({ type: "info", title: "Subscription canceled", description: "Workspace downgraded to Free." });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (err: Error) => toast({ type: "error", title: "Cancel failed", description: err.message }),
  });

  const sub = data?.subscription;
  const currentCode = sub?.planCode ?? data?.tenant.plan ?? "FREE";
  const plans: Plan[] = catalog?.business ?? [];
  const entitlements = data?.entitlements ?? [];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Subscription, invoices and feature entitlements for {data?.tenant.name ?? "your workspace"}.
        </p>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <SkeletonCard lines={5} className="lg:col-span-2 h-64" />
          <SkeletonCard lines={4} className="h-64" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Subscription */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Current plan</CardTitle>
                  <CardDescription>Business model subscription (local payment mode)</CardDescription>
                </div>
                <Badge variant={(STATUS_STYLE[sub?.status ?? ""] ?? "neutral") as never}>
                  {sub?.status ?? "ACTIVE"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{currentCode.charAt(0) + currentCode.slice(1).toLowerCase()}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {sub?.seats ?? 1} seat(s) · {sub?.currentPeriodEnd ? `renews ${formatDate(sub.currentPeriodEnd)}` : "no active period"}
                      {sub?.provider === "local" && " · local provider"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {sub && sub.status !== "CANCELED" && (
                      <Button variant="outline" size="sm" loading={cancel.isPending} onClick={() => cancel.mutate()}>
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    )}
                    <Link href="/settings">
                      <Button variant="outline" size="sm"><CreditCard className="h-4 w-4" /> Payment settings</Button>
                    </Link>
                  </div>
                </div>
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Included features</p>
                  <div className="flex flex-wrap gap-2">
                    {entitlements.map((e) => (
                      <span key={e} className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" /> {e.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Usage</CardTitle>
                <CardDescription>Current billing period</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Active clients", value: data?.usage.clients ?? 0 },
                  { label: "Reports ingested", value: data?.usage.reports ?? 0 },
                  { label: "Letters sent", value: data?.usage.lettersSent ?? 0 },
                ].map((u) => (
                  <div key={u.label} className="flex items-center justify-between rounded-xl border border-white/6 bg-white/3 px-4 py-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">{u.label}</span>
                    <span className="text-lg font-bold">{u.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Plan switcher */}
          <Card>
            <CardHeader>
              <CardTitle>Switch plan</CardTitle>
              <CardDescription>Entitlements update immediately — the next invoice reflects your new plan.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                {plans.map((p) => {
                  const isCurrent = p.code === currentCode;
                  const isFree = p.code === "FREE";
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "relative flex flex-col rounded-2xl border p-5 transition-colors",
                        isCurrent ? "border-brand-500/40 bg-brand-500/6" : "border-white/6 bg-white/3 hover:border-brand-500/25",
                      )}
                    >
                      {p.popular && !isCurrent && (
                        <Badge className="absolute -top-2.5 right-3 px-2 py-0.5 text-[10px]">Popular</Badge>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{p.name}</p>
                        {isCurrent && <Badge variant="success"><Check className="h-3 w-3" /> Current</Badge>}
                      </div>
                      <p className="mt-2 text-2xl font-bold tracking-tight">{p.priceCents === 0 ? "Free" : money(p.priceCents)}<span className="text-xs font-normal text-slate-400">/mo</span></p>
                      <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-slate-500 dark:text-slate-400">{p.description}</p>
                      <Button
                        size="sm"
                        variant={isCurrent ? "outline" : isFree ? "outline" : "default"}
                        className="mt-4"
                        disabled={isCurrent}
                        loading={checkout.isPending && checkout.variables === p.code}
                        onClick={() => checkout.mutate(p.code)}
                      >
                        {isCurrent ? "Current plan" : isFree ? "Downgrade" : "Switch"}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                Enterprise pricing is custom —{" "}
                <Link href="/contact" className="font-medium text-brand-600 hover:underline dark:text-brand-400">contact us</Link> for a quote.
              </p>
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Billing history for this workspace</CardDescription>
            </CardHeader>
            <CardContent>
              {!data || data.invoices.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No invoices yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/6 text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="pb-2.5 pr-4 font-medium">Invoice</th>
                        <th className="pb-2.5 pr-4 font-medium">Description</th>
                        <th className="pb-2.5 pr-4 font-medium">Amount</th>
                        <th className="pb-2.5 pr-4 font-medium">Status</th>
                        <th className="pb-2.5 font-medium">Issued</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.invoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-white/4 last:border-0">
                          <td className="py-3 pr-4 font-medium">{inv.number}</td>
                          <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{inv.description}</td>
                          <td className="py-3 pr-4 font-semibold">{money(inv.amountCents)}</td>
                          <td className="py-3 pr-4"><Badge variant={statusVariant(inv.status)}>{inv.status}</Badge></td>
                          <td className="py-3 text-slate-400">{formatDate(inv.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
