"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type Letter, type LetterTemplate, type CreditReport, type User } from "@/lib/api";
import { useRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Tabs } from "@/components/ui/tabs";
import { formatDate, cn } from "@/lib/utils";
import { FileText, Mail, Plus, ArrowRight, Sparkles, Star } from "@/components/ui/icons";

export default function LettersPage() {
  const { isStaff } = useRole();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = React.useState("templates");
  const [genOpen, setGenOpen] = React.useState(false);
  const [form, setForm] = React.useState<{ templateId: string; clientId: string; accountId: string }>({ templateId: "", clientId: "", accountId: "" });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<{ items: LetterTemplate[] }>("/letters/templates"),
  });

  const { data: letters, isLoading: lettersLoading } = useQuery({
    queryKey: ["letters"],
    queryFn: () => api.get<{ items: Letter[]; total: number }>("/letters"),
    enabled: tab === "letters",
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<{ items: User[] }>("/users/clients"),
    enabled: isStaff,
  });

  const { data: clientReports } = useQuery({
    queryKey: ["reports-by-client", form.clientId],
    queryFn: () => api.get<{ items: CreditReport[] }>(`/reports?clientId=${form.clientId}`),
    enabled: Boolean(form.clientId),
  });

  const selectedTemplate = templates?.items.find((t) => t.id === form.templateId);

  const generate = useMutation({
    mutationFn: () =>
      api.post<Letter>("/letters/generate", {
        templateId: form.templateId,
        clientId: form.clientId,
        accountId: form.accountId || undefined,
      }),
    onSuccess: (letter) => {
      toast({ type: "success", title: "Letter generated", description: "Review and edit before sending." });
      setGenOpen(false);
      setForm({ templateId: "", clientId: "", accountId: "" });
      qc.invalidateQueries({ queryKey: ["letters"] });
      window.location.href = `/letters/${letter.id}`;
    },
    onError: (e: Error) => toast({ type: "error", title: "Generation failed", description: e.message }),
  });

  const toggleFavorite = useMutation({
    mutationFn: ({ id, fav }: { id: string; fav: boolean }) =>
      api.post(`/letters/templates/${id}/favorite`, { favorite: fav }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  const categories = [...new Set((templates?.items ?? []).map((t) => t.category).filter(Boolean))];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Letters</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            FCRA-compliant templates with merge fields, version history and PDF export.
          </p>
        </div>
        {isStaff && (
          <Button size="sm" onClick={() => setGenOpen(true)}>
            <Plus className="h-4 w-4" /> Generate letter
          </Button>
        )}
      </motion.div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "templates", label: "Templates", count: templates?.items.length },
          { value: "letters", label: "Letters", count: letters?.total },
        ]}
      />

      {tab === "templates" && (
        <>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="violet">All</Badge>
              {categories.map((c) => (
                <Badge key={c} variant="neutral">{c}</Badge>
              ))}
            </div>
          )}
          {templatesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} lines={3} className="h-40" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates?.items.map((t) => (
                <Card key={t.id} className="card-hover flex flex-col p-5">
                  <div className="flex items-start justify-between">
                    <Badge variant="violet">{t.letterType}</Badge>
                    <button
                      onClick={() => toggleFavorite.mutate({ id: t.id, fav: !t.isFavorite })}
                      className={cn("rounded-lg p-1 transition-colors hover:bg-amber-500/10", t.isFavorite ? "text-amber-400" : "text-slate-400")}
                      aria-label="Toggle favorite"
                    >
                      <Star className="h-4 w-4" fill={t.isFavorite ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <p className="mt-3 font-semibold">{t.name}</p>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-400">
                    {t.description ?? `${t.category ?? "General"} template · v${t.version}`}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3">
                    <span className="text-[11px] text-slate-400">{t.category}</span>
                    {isStaff ? (
                      <button
                        className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                        onClick={() => {
                          setForm({ templateId: t.id, clientId: "", accountId: "" });
                          setGenOpen(true);
                        }}
                      >
                        Use template <ArrowRight className="h-3 w-3" />
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">v{t.version}</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "letters" && (
        lettersLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} lines={2} className="h-20" />
            ))}
          </div>
        ) : !letters || letters.items.length === 0 ? (
          <EmptyState
            icon={<Mail className="h-6 w-6" />}
            title="No letters yet"
            description="Generate a letter from a template — merge fields pull client and account data automatically."
          />
        ) : (
          <div className="space-y-3">
            {letters.items.map((l) => (
              <Link key={l.id} href={`/letters/${l.id}`}>
                <Card className="card-hover flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-violet-500/10 text-brand-500">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {l.client.name} · {l.letterType} · v{l.version} · {formatDate(l.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )
      )}

      <Dialog open={genOpen} onClose={() => setGenOpen(false)} title="Generate letter" description="Merge fields are filled from the client profile and the selected account.">
        <div className="space-y-4">
          <Field label="Template">
            <Select value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
              <option value="">Select template…</option>
              {templates?.items.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          {selectedTemplate && (
            <div className="max-h-24 overflow-y-auto rounded-lg bg-white/4 p-3 text-[11px] leading-relaxed text-slate-400 scrollbar-thin">
              {selectedTemplate.body.slice(0, 320)}…
            </div>
          )}
          <Field label="Client">
            <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value, accountId: "" })}>
              <option value="">Select client…</option>
              {clients?.items.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
              ))}
            </Select>
          </Field>
          {form.clientId && clientReports && clientReports.items.length > 0 && (
            <Field label="Account (optional)" hint="Pulls account details into merge fields">
              <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">No account context</option>
                {clientReports.items.flatMap((r) =>
                  r.accounts.map((a) => (
                    <option key={a.id} value={a.id}>{r.bureau} · {a.accountName}</option>
                  )),
                )}
              </Select>
            </Field>
          )}
          <Button className="w-full" loading={generate.isPending} disabled={!form.templateId || !form.clientId} onClick={() => generate.mutate()}>
            <Sparkles className="h-4 w-4" /> Generate letter
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
