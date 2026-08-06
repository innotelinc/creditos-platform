"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Sparkles, Mail, Gavel, TrendingUp, Shield, Users } from "@/components/ui/icons";

const FEATURES = [
  { icon: <FileText className="h-5 w-5" />, title: "Credit report ingestion", desc: "Experian, Equifax and TransUnion CSVs and PDFs. Heuristic parsers plus an OCR fallback normalize tradelines, inquiries and public records.", color: "from-brand-500/15 to-violet-500/10 text-brand-500" },
  { icon: <Sparkles className="h-5 w-5" />, title: "AI credit analysis", desc: "Duplicate accounts, obsolete collections, incorrect balances and statute-of-limitations issues — every finding scored with confidence and a recommended dispute.", color: "from-violet-500/15 to-fuchsia-500/10 text-violet-500" },
  { icon: <Mail className="h-5 w-5" />, title: "Letter generator", desc: "609, 611, 623, 604, identity theft, goodwill, pay-for-delete and more. Merge fields, version history, and one-click PDF export.", color: "from-cyan-500/15 to-blue-500/10 text-cyan-500" },
  { icon: <Gavel className="h-5 w-5" />, title: "Dispute workflow engine", desc: "Rounds 1–3 with status tracking from Sent → Delivered → Received → Response. Escalate to attorney review or CFPB filing.", color: "from-rose-500/15 to-orange-500/10 text-rose-500" },
  { icon: <TrendingUp className="h-5 w-5" />, title: "Score forecasting", desc: "Estimated score impact for every disputed item, so clients see the upside of each action before you send it.", color: "from-emerald-500/15 to-teal-500/10 text-emerald-500" },
  { icon: <Users className="h-5 w-5" />, title: "CRM & sales pipeline", desc: "Leads, stages, deal values and activity timelines on the Business plan — from first touch to won client.", color: "from-sky-500/15 to-indigo-500/10 text-sky-500" },
  { icon: <Shield className="h-5 w-5" />, title: "Compliance built in", desc: "RBAC across six roles, multi-tenant isolation, audit trails, required §1679c disclosures, and FCRA-aware letter drafting.", color: "from-amber-500/15 to-yellow-500/10 text-amber-500" },
  { icon: <Sparkles className="h-5 w-5" />, title: "Client portal & monitoring", desc: "Clients follow dispute timelines, download letters, e-sign and upload documents — plus bureau response reader and automation rules.", color: "from-lime-500/15 to-emerald-500/10 text-lime-500" },
];

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-16 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Everything a repair operation needs, <span className="text-gradient">in one platform</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-500 dark:text-slate-400">
            From raw report to resolved dispute, CreditOS automates the busywork so specialists focus on outcomes.
          </p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} {...fade} transition={{ duration: 0.55, delay: i * 0.05 }} className="glass card-hover rounded-2xl p-6">
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.color}`}>{f.icon}</div>
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <motion.div {...fade} className="glass-strong relative overflow-hidden rounded-3xl p-10 text-center sm:p-14">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Compare plans for your agency</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">Free to start, scale as you grow — pricing for both agencies and their clients.</p>
          <Link href="/pricing" className="mt-8 inline-block">
            <Button size="lg">See pricing <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </motion.div>
      </section>
    </MarketingShell>
  );
}
