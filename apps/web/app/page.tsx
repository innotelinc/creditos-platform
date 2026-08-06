"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreRing, Sparkline, Progress } from "@/components/ui/charts";
import {
  Sparkles,
  FileText,
  Gavel,
  Mail,
  Shield,
  TrendingUp,
  ArrowRight,
  ChartPie,
  Users,
  AlertTriangle,
} from "@/components/ui/icons";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

export default function LandingPage() {
  return (
    <div className="landing-bg min-h-screen text-slate-900 dark:text-slate-100">
      {/* Nav */}
      <header className="glass-strong sticky top-0 z-40 border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            <Link href="/features" className="transition-colors hover:text-slate-900 dark:hover:text-white">Features</Link>
            <Link href="/pricing" className="transition-colors hover:text-slate-900 dark:hover:text-white">Pricing</Link>
            <Link href="/knowledge-base" className="transition-colors hover:text-slate-900 dark:hover:text-white">Help center</Link>
            <Link href="/about" className="transition-colors hover:text-slate-900 dark:hover:text-white">About</Link>
            <Link href="/contact" className="transition-colors hover:text-slate-900 dark:hover:text-white">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Start free trial</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-6 pt-20 pb-16 text-center sm:pt-28">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Badge className="mb-6 px-3 py-1 text-xs">Built for credit repair agencies & consumers</Badge>
          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
            The AI operating system for{" "}
            <span className="text-gradient">credit repair</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500 dark:text-slate-400">
            Ingest credit reports, detect errors with AI, generate FCRA-compliant dispute letters, and run
            rounds 1–3 of the dispute workflow — all in one multi-tenant platform.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg">
                Start your workspace <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how">
              <Button variant="outline" size="lg">See how it works</Button>
            </Link>
          </div>
        </motion.div>

        {/* Dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 48, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-gradient-to-r from-brand-500/20 via-violet-500/15 to-cyan-400/20 blur-3xl" />
          <div className="glass-strong relative grid grid-cols-12 gap-4 rounded-3xl p-5 text-left shadow-2xl">
            {/* Sidebar mock */}
            <div className="col-span-2 hidden flex-col gap-2 rounded-2xl bg-white/40 p-3 sm:flex dark:bg-white/4">
              {[
                { icon: <ChartPie className="h-4 w-4" />, label: "Dashboard", active: true },
                { icon: <FileText className="h-4 w-4" />, label: "Reports" },
                { icon: <Gavel className="h-4 w-4" />, label: "Disputes" },
                { icon: <Mail className="h-4 w-4" />, label: "Letters" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium ${
                    item.active
                      ? "bg-gradient-to-r from-brand-500/15 to-violet-500/10 text-brand-700 dark:text-brand-300"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {item.icon} {item.label}
                </div>
              ))}
            </div>
            {/* Main mock */}
            <div className="col-span-12 space-y-4 sm:col-span-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Good morning, Alex</p>
                  <p className="text-sm font-semibold">Your credit in motion</p>
                </div>
                <Badge variant="violet">FICO 612 → 682 projected</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="glass rounded-2xl p-4">
                  <ScoreRing score={612} size={96} stroke={8} label="Current" />
                </div>
                <div className="glass col-span-2 rounded-2xl p-4">
                  <p className="mb-2 text-xs font-medium text-slate-400">Score trajectory</p>
                  <div className="flex items-center gap-4">
                    <Sparkline data={[586, 590, 601, 598, 612, 618, 641, 656, 682]} width={220} height={72} />
                    <div className="hidden text-xs text-emerald-500 sm:block">
                      <TrendingUp className="mb-1 h-4 w-4" />
                      +70 pts
                    </div>
                  </div>
                </div>
                <div className="glass rounded-2xl p-4">
                  <p className="mb-3 text-xs font-medium text-slate-400">Negative items</p>
                  <div className="space-y-2.5">
                    {[
                      { label: "Collections", value: 2 },
                      { label: "Charge-offs", value: 1 },
                    ].map((r) => (
                      <div key={r.label}>
                        <div className="mb-1 flex justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
                          <span className="font-semibold">{r.value}</span>
                        </div>
                        <Progress value={(r.value / 3) * 100} color={r.label === "Collections" ? "#f43f5e" : "#f59e0b"} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  { icon: <AlertTriangle className="h-4 w-4 text-rose-400" />, label: "Obsolete collection", meta: "604 letter ready" },
                  { icon: <Sparkles className="h-4 w-4 text-brand-400" />, label: "AI analysis", meta: "4 findings · 92% conf." },
                  { icon: <Gavel className="h-4 w-4 text-violet-400" />, label: "Round 2", meta: "Capital One · due Aug 29" },
                  { icon: <Users className="h-4 w-4 text-cyan-400" />, label: "Tasks", meta: "2 due this week" },
                ].map((item) => (
                  <div key={item.label} className="glass flex items-center gap-3 rounded-2xl p-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/50 dark:bg-white/5">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{item.label}</p>
                      <p className="truncate text-[11px] text-slate-400">{item.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Logos strip */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <span>Experian</span>
          <span>Equifax</span>
          <span>TransUnion</span>
          <span className="text-gradient normal-case tracking-normal">+ OCR & CSV ingestion</span>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 pb-24">
        <motion.div {...fade} className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a repair operation needs
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">
            From raw report to resolved dispute, CreditOS automates the busywork so specialists focus on outcomes.
          </p>
        </motion.div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <FileText className="h-5 w-5" />,
              title: "Report ingestion",
              desc: "Upload Experian, Equifax or TransUnion CSVs and PDFs. Heuristic parsers + OCR fallback normalize tradelines, inquiries and public records.",
              color: "from-brand-500/15 to-violet-500/10 text-brand-500",
            },
            {
              icon: <Sparkles className="h-5 w-5" />,
              title: "AI credit analysis",
              desc: "Duplicate accounts, obsolete collections, incorrect balances, SOL flags — every finding scored with confidence and a recommended dispute.",
              color: "from-violet-500/15 to-fuchsia-500/10 text-violet-500",
            },
            {
              icon: <Mail className="h-5 w-5" />,
              title: "Letter generator",
              desc: "609, 611, 623, 604, identity theft, goodwill, pay-for-delete and more. Merge fields, version history, and one-click PDF export.",
              color: "from-cyan-500/15 to-blue-500/10 text-cyan-500",
            },
            {
              icon: <Gavel className="h-5 w-5" />,
              title: "Dispute workflow engine",
              desc: "Rounds 1–3 with status tracking from Sent → Delivered → Received → Response. Escalate to attorney review or CFPB.",
              color: "from-rose-500/15 to-orange-500/10 text-rose-500",
            },
            {
              icon: <TrendingUp className="h-5 w-5" />,
              title: "Score forecasting",
              desc: "Estimated score impact for every disputed item, so clients see the upside of each action before you send it.",
              color: "from-emerald-500/15 to-teal-500/10 text-emerald-500",
            },
            {
              icon: <Shield className="h-5 w-5" />,
              title: "Compliance built in",
              desc: "RBAC across six roles, multi-tenant isolation, audit trails, required disclosures, and FCRA-aware letter drafting.",
              color: "from-amber-500/15 to-yellow-500/10 text-amber-500",
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              {...fade}
              transition={{ duration: 0.55, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="glass card-hover rounded-2xl p-6"
            >
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl px-6 pb-24">
        <motion.div {...fade} className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">From report to resolution</h2>
        </motion.div>
        <div className="grid gap-5 md:grid-cols-5">
          {[
            ["01", "Upload", "CSV or PDF from any bureau"],
            ["02", "Analyze", "AI flags errors with confidence scores"],
            ["03", "Generate", "FCRA-compliant letter, edited & approved"],
            ["04", "Send & track", "Round 1, certified mail, delivery timeline"],
            ["05", "Escalate", "Round 2–3, CFPB, or attorney review"],
          ].map(([n, t, d], i) => (
            <motion.div key={n} {...fade} transition={{ duration: 0.5, delay: i * 0.08 }} className="glass relative rounded-2xl p-5">
              <span className="text-gradient text-2xl font-bold">{n}</span>
              <h3 className="mt-2 font-semibold">{t}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{d}</p>
              {i < 4 && <ArrowRight className="absolute -right-3.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-400 md:block" />}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 pb-24">
        <motion.div {...fade} className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, outcome-based pricing</h2>
        </motion.div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { name: "Starter", price: "$49", desc: "For individual repair specialists", features: ["5 active clients", "Report ingestion", "AI analysis", "Letter library"] },
            { name: "Professional", price: "$149", desc: "For growing agencies", features: ["50 active clients", "Dispute workflow rounds 1–3", "Bureau response reader", "Client portal"], featured: true },
            { name: "Business", price: "$399", desc: "For multi-branch operations", features: ["Unlimited clients", "Multi-tenant white label", "CRM & pipeline", "API access"] },
          ].map((p, i) => (
            <motion.div
              key={p.name}
              {...fade}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`relative rounded-3xl p-7 ${p.featured ? "glass-strong shadow-2xl shadow-brand-900/20 ring-2 ring-brand-500/50" : "glass"}`}
            >
              {p.featured && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3">Most popular</Badge>
              )}
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{p.desc}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{p.price}</span>
                <span className="text-sm text-slate-400">/mo</span>
              </div>
              <ul className="mt-5 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 text-[10px]">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="mt-6 block">
                <Button variant={p.featured ? "default" : "outline"} className="w-full">
                  Start free trial
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <motion.div {...fade} className="glass-strong relative overflow-hidden rounded-3xl p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500/25 to-cyan-400/20 blur-3xl" />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">Ready to build the repair operation of the future?</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">
            Spin up your workspace in under a minute. Import a report, run the analysis, and send your first dispute letter today.
          </p>
          <Link href="/register" className="relative mt-8 inline-block">
            <Button size="lg">
              Create your workspace <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
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
            <Link href="/login" className="hover:text-slate-600 dark:hover:text-slate-200">Sign in</Link>
            <Link href="/register" className="hover:text-slate-600 dark:hover:text-slate-200">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
