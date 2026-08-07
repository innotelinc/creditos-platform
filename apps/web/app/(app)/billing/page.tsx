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
import { CreditCard, Check, Sparkles, Shield, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/auth";

function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "success",
  TRIALING: "info",
  PAST_DUE: "warning",
  CANCELED: "neutral",
  EXPIRED: "danger",
};

export default function BillingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isClient, isConsumer } = useRole();
  // Self-signup consumers (registered as CLIENT on their own tenant) get a
  // self-service view focused on buying/managing Credit Monitoring.
  const consumerView = isClient && isConsumer;

  const { data, isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: () => api.get<BillingSummary>("/billing/summary"),
  });
  const { data: catalog } = useQuery({
    queryKey: ["pricing"],
    queryFn: () => api.get<PricingCatalog>("/pricing/public"),
  });

  const checkout = useMutation({
    mutationFn: (planCode: string) =>
      api.post<{ url?: string; success?: boolean; invoice?: { number: string } }>(
        "/billing/checkout",
        consumerView ? { planCode, model: "CONSUMER" } : { planCode },
      ),
    onSuccess: (res) => {
      if (res.url) {
        // Stripe mode — redirect to checkout
        window.location.href = res.url;
        return;
      }
      toast({ type: "success", title: "Plan updated", description: `Invoice ${res.invoice?.number ?? ""} issued.` });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["pricing"] });
      // The paywall (`blocked`) flips as soon as the subscription is active —
      // refetch immediately so consumers aren't bounced back after subscribing.
      qc.invalidateQueries({ queryKey: ["billing-status"] });
    },
    onError: (err: Error) => toast({ type: "error", title: "Checkout failed", description: err.message }),
  });

  const portal = useMutation({
    mutationFn: () => api.post<{ url: string }>("/billing/portal", {}),
    onSuccess: (res) => { window.location.href = res.url; },
    onError: (err: Error) => toast({ type: "error", title: "Portal failed", description: err.message }),
  });

  const cancel = useMutation({
    mutationFn: () => api.post<{ success: boolean }>("/billing/cancel", {}),
    onSuccess: () => {
      toast({ type: "info", title: "Subscription canceled" });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (err: Error) => toast({ type: "error", title: "Cancel failed", description: err.message }),
  });

  const sub = data?.subscription;
  const currentCode = sub?.planCode ?? data?.tenant.plan ?? "TRIAL";
  const plans: Plan[] = catalog?.business ?? [];
  const entitlements = data?.entitlements ?? [];
  const expired = sub?.status === "EXPIRED";
  // The consumer purchase path sells the MONITORING plan directly.
  const monitoring = (catalog?.consumer ?? []).find((p) => p.code === "MONITORING");
  const onMonitoring = !!sub && sub.planCode === "MONITORING" && sub.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {consumerView
            ? "Your Credit Monitoring subscription, invoices and access status."
            : `Subscription, invoices and feature entitlements for ${data?.tenant.name ?? "your workspace"}.`}
        </p>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <SkeletonCard lines={5} className="lg:col-span-2 h-64" />
          <SkeletonCard lines={4} className="h-64" />
        </div>
      ) : (
        <>
          {(expired || !sub) && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/8 px-5 py-4" role="alert">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/12 text-rose-500">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-rose-600 dark:text-rose-300">No active plan</p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {consumerView
                    ? "Subscribe to Credit Monitoring below to unlock your workspace — daily 3-bureau scores, alerts and monthly report pulls. There are no free trials."
                    : "There are no free trials — choose a plan below to unlock reports, pulls, analysis, disputes and letters. Your workspace data is safe until then."}
                </p>
              </div>
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Subscription */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Current plan</CardTitle>
                  <CardDescription>
                    {sub?.provider === "stripe" ? "Billed and managed through Stripe" : "Paid plans — local/simulated billing mode (no free trials)"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={(STATUS_STYLE[sub?.status ?? ""] ?? "neutral") as never}>
                    {sub?.status ?? "ACTIVE"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-2xl font-bold tracking-tight">
                      {!sub ? "No active plan" : currentCode.charAt(0) + currentCode.slice(1).toLowerCase()}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {sub ? `${sub.seats ?? 1} seat(s) · ${sub.currentPeriodEnd ? `renews ${formatDate(sub.currentPeriodEnd)}` : "no active period"}` : "Subscribe below to get started"}
                      {sub?.provider === "local" && " · local provider"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {sub && sub.status !== "CANCELED" && sub.status !== "EXPIRED" && (
                      <Button variant="outline" size="sm" loading={cancel.isPending} onClick={() => cancel.mutate()}>
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    )}
                    {sub?.provider === "stripe" && (
                      <Button variant="outline" size="sm" loading={portal.isPending} onClick={() => portal.mutate()}>
                        <CreditCard className="h-4 w-4" /> Manage billing
                      </Button>
                    )}
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

            {/* Usage (agency view only) */}
            {!consumerView && (
              <Card>
                <CardHeader>
                  <CardTitle>Usage</CardTitle>
                  <CardDescription>Current billing period</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Active clients", value: data?.usage.clients ?? 0 },
                    { label: "Reports ingested", value: data?.usage.reports ?? 0 },
                    {
                      label: "Report pulls",
                      value: data?.allowance
                        ? `${data.allowance.used} / ${data.allowance.included}`
                        : data?.usage.pulls ?? 0,
                    },
                    { label: "Letters sent", value: data?.usage.lettersSent ?? 0 },
                  ].map((u) => (
                    <div key={u.label} className="flex items-center justify-between rounded-xl border border-white/6 bg-white/3 px-4 py-3">
                      <span className="text-sm text-slate-500 dark:text-slate-400">{u.label}</span>
                      <span className="text-lg font-bold">{u.value}</span>
                    </div>
                  ))}
                  {data?.allowance?.mode === "metered" && (
                    <p className="flex items-start gap-1.5 pt-1 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Allowance used — additional pulls are billed via Stripe at {money(data.allowance.overageCents)}/pull.
                    </p>
                  )}
                  {data?.allowance?.mode === "blocked" && (
                    <p className="flex items-start gap-1.5 pt-1 text-xs leading-relaxed text-rose-600 dark:text-rose-400">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Allowance used — further pulls are blocked until the period resets or you upgrade.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Credit monitoring upsell (agency view only) */}
          {!consumerView && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-500">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Offer 3-bureau credit monitoring to your clients</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Resell monitoring at the provider&apos;s price — powered by our bureau partner (SmartCredit / IdentityIQ).
                  Clients get daily scores and alerts; you get automatic report pulls from their share codes.
                </p>
              </div>
              <Link href="/pricing?model=consumer">
                <Button variant="outline" size="sm">View monitoring plan</Button>
              </Link>
            </div>
          )}

          {/* Consumer purchase path: direct Credit Monitoring subscription */}
          {consumerView ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Credit Monitoring</CardTitle>
                  <CardDescription>
                    Daily 3-bureau scores, inquiry & collection alerts — billed monthly at the provider&apos;s price.
                  </CardDescription>
                </div>
                {onMonitoring && <Badge variant="success"><Check className="h-3 w-3" /> Active</Badge>}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="min-w-[16rem]">
                    <p className="text-3xl font-bold tracking-tight">
                      {monitoring ? money(monitoring.priceCents) : "—"}
                      <span className="text-xs font-normal text-slate-400">/mo</span>
                    </p>
                    <ul className="mt-3 space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                      {(monitoring?.features ?? []).map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    {onMonitoring ? (
                      <>
                        <p className="text-sm text-slate-400">
                          {sub?.currentPeriodEnd ? `Renews ${formatDate(sub.currentPeriodEnd)}` : "Monitoring active"}
                        </p>
                        {sub?.provider === "stripe" && (
                          <Button variant="outline" size="sm" loading={portal.isPending} onClick={() => portal.mutate()}>
                            <CreditCard className="h-4 w-4" /> Manage billing
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        size="lg"
                        loading={checkout.isPending && checkout.variables === "MONITORING"}
                        onClick={() => checkout.mutate("MONITORING")}
                      >
                        <Shield className="h-4 w-4" /> Subscribe to Credit Monitoring
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Plan switcher (agency view) */
            <Card>
              <CardHeader>
                <CardTitle>Switch plan</CardTitle>
                <CardDescription>No free trials — the first checkout charges immediately. Entitlements update right away.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                  {plans.map((p) => {
                    const isCurrent = !expired && p.code === currentCode;
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
                        <p className="mt-2 text-2xl font-bold tracking-tight">{p.priceCents === 0 ? "Custom" : money(p.priceCents)}<span className="text-xs font-normal text-slate-400">/mo</span></p>
                        <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-slate-500 dark:text-slate-400">{p.description}</p>
                        <Button
                          size="sm"
                          variant={isCurrent ? "outline" : "default"}
                          className="mt-4"
                          disabled={isCurrent}
                          loading={checkout.isPending && checkout.variables === p.code}
                          onClick={() => checkout.mutate(p.code)}
                        >
                          {expired ? "Subscribe" : isCurrent ? "Current plan" : "Switch"}
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
          )}

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
