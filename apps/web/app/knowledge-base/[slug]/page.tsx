"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type KnowledgeArticle } from "@/lib/api";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function KnowledgeArticlePage() {
  const params = useParams<{ slug: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["knowledge", params.slug],
    queryFn: () => api.get<KnowledgeArticle>(`/knowledge/articles/${params.slug}`),
  });

  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-24">
        <Link href="/knowledge-base" className="text-sm text-slate-400 transition-colors hover:text-brand-500">
          ← All articles
        </Link>
        {isLoading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : data ? (
          <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mt-6">
            <Badge variant="neutral" className="capitalize">{data.category.replace("-", " ")}</Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{data.title}</h1>
            <div className="prose-invert mt-8 space-y-4 whitespace-pre-line text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
              {data.body}
            </div>
            <div className="mt-10 rounded-2xl border border-white/6 bg-white/3 p-5 text-sm text-slate-500 dark:text-slate-400">
              Still stuck?{" "}
              <Link href="/contact" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                Contact us
              </Link>{" "}
              and we will point you in the right direction.
            </div>
          </motion.article>
        ) : (
          <p className="py-16 text-center text-sm text-slate-500">Article not found.</p>
        )}
      </section>
    </MarketingShell>
  );
}
