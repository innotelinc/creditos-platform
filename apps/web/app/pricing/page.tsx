"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type Plan, type PricingCatalog } from "@/lib/api";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { SkeletonCard } from "@/components/ui/skeleton";
import { ArrowRight, Building, User } from "@/components/ui/icons";

function formatPrice(plan: Plan): { amount: string; suffix: string } {
  if (plan.priceCents === 0) return { amount: "Custom", suffix: "" };
  const amount = `$${(plan.priceCents / 100).toFixed(plan.priceCents % 100 === 0 ? 0 : 2)}`;
  const suffix = plan.interval === "ONE_TIME" ? " one-time" : plan.interval === "YEAR" ? "/yr" : "/mo";
  return { amount, suffix };
}

function PlanCard({ plan, cta }: { plan: Plan; cta: { label: string; href: string } }) {
  const price = formatPrice(plan);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`relative rounded-3xl p-7 ${plan.popular ? "glass-strong shadow-2xl shadow-brand-900/20 ring-2 ring-brand-500/50" : "glass"}`}
    >
      {plan.popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3">Most popular</Badge>}
      <h3 className="font-semibold">{plan.name}</h3>
      <p className="mt-1 min-h-[2.5rem] text-xs leading-relaxed text-slate-500 dark:text-slate-400">{plan.description}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight">{price.amount}</span>
        <span className="text-sm text-slate-400">{price.suffix}</span>
      </div>
      <ul className="mt-5 space-y-2.5 text-sm">
        {(plan.features ?? []).map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-500">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link href={cta.href} className="mt-6 block">
        <Button variant={plan.popular ? "default" : "outline"} className="w-full">
          {cta.label}
        </Button>
      </Link>
    </motion.div>
  );
}

export default function PricingPage() {
  const [model, setModel] = React.useState<"business" | "consumer">("business");
  const { data, isLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: () => api.get<PricingCatalog>("/pricing/public"),
  });

  const plans: Plan[] = data ? data[model] : [];
  const trialDays = data?.trialDays ?? 3;
  const heading =
    model === "business"
      ? "For credit repair agencies"
      : "For clients repairing their credit";

  return (
    <div className="landing-bg min-h-screen text-slate-900 dark:text-slate-100">
      <header className="glass-strong sticky top-0 z-40 border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/"><Logo /></Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            <Link href="/features" className="transition-colors hover:text-slate-900 dark:hover:text-white">Features</Link>
            <Link href="/knowledge-base" className="transition-colors hover:text-slate-900 dark:hover:text-white">Help center</Link>
            <Link href="/about" className="transition-colors hover:text-slate-900 dark:hover:text-white">About</Link>
            <Link href="/contact" className="transition-colors hover:text-slate-900 dark:hover:text-white">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link href="/register"><Button size="sm">Start free trial</Button></Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pt-16 pb-12 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Badge className="mb-6 px-3 py-1 text-xs">Transparent pricing — no hidden fees</Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Pricing built for both sides of the repair process</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-500 dark:text-slate-400">
            CreditOS is the operating system for credit repair — one catalog for the agencies that run
            the platform, and another for the services those agencies offer their clients.
          </p>
        </motion.div>

        <div className="mx-auto mt-10 max-w-md">
          <Tabs
            value={model}
            onChange={(v) => setModel(v as "business" | "consumer")}
            tabs={[
              { value: "business", label: "For agencies" },
              { value: "consumer", label: "For clients" },
            ]}
          />
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {model === "business" ? <Building className="h-4 w-4 text-brand-500" /> : <User className="h-4 w-4 text-cyan-500" />}
          {heading}
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={6} className="h-80" />)}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                cta={{ label: "Start free trial", href: "/register" }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass rounded-3xl p-8 sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight">Frequently asked</h2>
          <div className="mt-6 space-y-5 text-sm">
            {[
              ["Can I switch plans later?", "Yes — switch anytime from the Billing page. Your invoice is issued immediately and entitlements update in real time."],
              ["What counts as an active client?", "Any client with at least one report, dispute or letter in the workspace. You can archive closed clients."],
              ["Is there a free trial?", `Yes — every new workspace starts with a ${trialDays}-day free trial with access to all features. After the trial, choose a paid plan that fits you.`],
              ["Does CreditOS charge consumers directly?", "No — consumer services (Kickstart, Standard, Complete, Monitoring) are sold by your agency. CreditOS bills agencies, not their clients."],
            ].map(([q, a]) => (
              <div key={q} className="rounded-xl border border-white/6 bg-white/3 p-4">
                <p className="font-semibold">{q}</p>
                <p className="mt-1 leading-relaxed text-slate-500 dark:text-slate-400">{a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass-strong relative overflow-hidden rounded-3xl p-10 text-center sm:p-14">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to get started?</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">
            {model === "business"
              ? `Spin up your agency workspace in under a minute — ${trialDays}-day free trial, no credit card required.`
              : "Sign up in under a minute and take control of your credit repair — no credit card required during your trial."}
          </p>
          <Link href="/register" className="mt-8 inline-block">
            <Button size="lg">Start your free trial <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <Logo size="sm" />
          <p className="max-w-xl text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">
            CreditOS is a documentation, letter-generation and dispute-tracking platform. It is not a law firm,
            is not a credit bureau, and does not provide legal advice. Credit outcomes are not guaranteed.
            15 U.S.C. § 1679c: consumers may dispute information directly with the bureaus at no cost.
          </p>
          <div className="flex items-center gap-6 text-xs font-medium text-slate-400">
            <Link href="/pricing" className="hover:text-slate-600 dark:hover:text-slate-200">Pricing</Link>
            <Link href="/knowledge-base" className="hover:text-slate-600 dark:hover:text-slate-200">Help center</Link>
            <Link href="/contact" className="hover:text-slate-600 dark:hover:text-slate-200">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
