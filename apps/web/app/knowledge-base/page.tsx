"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type KnowledgeArticle, type KnowledgeCategory } from "@/lib/api";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Search, FileText, ArrowRight } from "@/components/ui/icons";

const CATEGORY_LABELS: Record<string, string> = {
  "getting-started": "Getting started",
  disputes: "Disputes",
  letters: "Letters",
  compliance: "Compliance",
  billing: "Billing",
  faq: "FAQ",
};

export default function KnowledgeBasePage() {
  const [category, setCategory] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  const { data: articles, isLoading } = useQuery({
    queryKey: ["knowledge", category, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (search) params.set("search", search);
      return api.get<{ items: KnowledgeArticle[] }>(`/knowledge/articles${params.toString() ? `?${params}` : ""}`);
    },
  });
  const { data: cats } = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: () => api.get<{ items: KnowledgeCategory[] }>("/knowledge/categories"),
  });

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-violet-500/10 text-brand-500">
            <FileText className="h-7 w-7" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Help center</h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-500 dark:text-slate-400">
            Guides on disputes, FCRA letters, compliance, and how the platform works.
          </p>
          <div className="relative mx-auto mt-8 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles…"
              className="pl-10"
            />
          </div>
        </motion.div>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          <Badge
            className={`cursor-pointer px-3 py-1.5 ${category === "all" ? "" : "opacity-60 hover:opacity-100"}`}
            variant={category === "all" ? "default" : "neutral"}
            onClick={() => setCategory("all")}
          >
            All topics
          </Badge>
          {cats?.items.map((c) => (
            <Badge
              key={c.category}
              className={`cursor-pointer px-3 py-1.5 ${category === c.category ? "" : "opacity-60 hover:opacity-100"}`}
              variant={category === c.category ? "default" : "neutral"}
              onClick={() => setCategory(c.category)}
            >
              {c.label} · {c.count}
            </Badge>
          ))}
        </div>

        <div className="mt-10 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} className="h-24" />)
          ) : !articles || articles.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">No articles match that search.</p>
          ) : (
            articles.items.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.04 }}>
                <Link href={`/knowledge-base/${a.slug}`} className="group flex items-center gap-4 rounded-2xl border border-white/6 bg-white/3 p-5 transition-all hover:border-brand-500/30 hover:bg-white/6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold group-hover:text-brand-600 dark:group-hover:text-brand-300">{a.title}</p>
                      <Badge variant="neutral">{CATEGORY_LABELS[a.category] ?? a.category}</Badge>
                    </div>
                    {a.excerpt && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{a.excerpt}</p>}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </MarketingShell>
  );
}
