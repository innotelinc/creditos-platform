"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Button } from "@/components/ui/button";
import { Shield, Users, TrendingUp, Lock } from "@/components/ui/icons";

const VALUES = [
  { icon: <Shield className="h-5 w-5" />, title: "Compliance first", desc: "Every feature is built around FCRA obligations, required disclosures, and consumer protections — because credit repair is heavily regulated and must be done right." },
  { icon: <Users className="h-5 w-5" />, title: "Consumers win too", desc: "Agencies run on CreditOS, but the real customer is the consumer whose report is being cleaned. Clear language, honest timelines, no inflated promises." },
  { icon: <TrendingUp className="h-5 w-5" />, title: "Outcomes over volume", desc: "We measure success by deletions, score movement and resolved disputes — not by letters sent. The platform surfaces the highest-impact actions first." },
  { icon: <Lock className="h-5 w-5" />, title: "Privacy by design", desc: "Encrypted document storage, tenant isolation, audit trails and least-privilege RBAC protect sensitive identity and credit data end to end." },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">The operating system for <span className="text-gradient">credit repair</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-500 dark:text-slate-400">
            CreditOS was built for the people who spend their days fighting inaccurate credit reporting:
            repair specialists, dispute analysts, attorneys, and the agencies that employ them.
          </p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass rounded-3xl p-8 sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight">Our mission</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            <p>
              Inaccurate credit reporting costs consumers money, housing, and opportunity. Yet most repair shops
              still run on spreadsheets, mail merges, and tribal knowledge. We built CreditOS to give every agency —
              from a solo specialist to a multi-branch firm — the same automation, compliance tooling and AI
              analysis that the biggest operations enjoy.
            </p>
            <p>
              The platform ingests credit reports, detects errors with AI, drafts FCRA-compliant letters, tracks
              dispute rounds against bureau deadlines, reads bureau responses, and keeps the whole case file in
              one auditable place.
            </p>
            <p className="rounded-xl border border-white/6 bg-white/3 p-4">
              <strong className="text-slate-700 dark:text-slate-200">An honest note:</strong> CreditOS is not a law
              firm, is not a credit bureau, and does not provide legal advice. Nothing on the platform guarantees a
              particular credit outcome — and we believe any service that claims it can is one to avoid.
            </p>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">What we value</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {VALUES.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="glass rounded-2xl p-6"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-violet-500/10 text-brand-500">{v.icon}</div>
              <h3 className="font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{v.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-2xl font-bold tracking-tight">Questions or partnership ideas?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 dark:text-slate-400">We would love to hear from you — whether you run an agency or are just getting started.</p>
          <Link href="/contact" className="mt-6 inline-block">
            <Button size="lg">Contact us</Button>
          </Link>
        </motion.div>
      </section>
    </MarketingShell>
  );
}
