"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type CrmLead, type CrmPipeline } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { timeAgo, formatCurrency } from "@/lib/utils";
import { Users, Plus, MessageSquare, Star } from "@/components/ui/icons";

const STAGES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
] as const;

const STAGE_COLORS: Record<string, string> = {
  NEW: "bg-slate-400",
  CONTACTED: "bg-cyan-400",
  QUALIFIED: "bg-amber-400",
  PROPOSAL: "bg-violet-400",
  WON: "bg-emerald-400",
  LOST: "bg-rose-400",
};

const emptyLead = { name: "", email: "", phone: "", company: "", source: "website", stage: "NEW", value: "", notes: "" };

export default function CrmPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyLead);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activity, setActivity] = React.useState({ type: "NOTE", subject: "", body: "" });

  const { data: pipeline } = useQuery({
    queryKey: ["crm-pipeline"],
    queryFn: () => api.get<CrmPipeline>("/crm/pipeline"),
  });
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: () => api.get<{ items: CrmLead[]; total: number }>("/crm/leads"),
  });
  const { data: active } = useQuery({
    queryKey: ["crm-lead", activeId],
    queryFn: () => api.get<CrmLead>(`/crm/leads/${activeId}`),
    enabled: Boolean(activeId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm-leads"] });
    qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
    qc.invalidateQueries({ queryKey: ["crm-lead"] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.post<CrmLead>("/crm/leads", {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
        source: form.source,
        stage: form.stage,
        value: form.value ? Math.round(Number(form.value) * 100) : undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast({ type: "success", title: "Lead created" });
      setCreateOpen(false);
      setForm(emptyLead);
      invalidate();
    },
    onError: (err: Error) => toast({ type: "error", title: "Could not create lead", description: err.message }),
  });

  const setStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.patch<CrmLead>(`/crm/leads/${id}`, { stage }),
    onSuccess: () => {
      invalidate();
    },
    onError: (err: Error) => toast({ type: "error", title: "Update failed", description: err.message }),
  });

  const addActivity = useMutation({
    mutationFn: () =>
      api.post<CrmLead>(`/crm/leads/${activeId}/activities`, {
        type: activity.type,
        subject: activity.subject,
        body: activity.body || undefined,
      }),
    onSuccess: () => {
      toast({ type: "success", title: "Activity logged" });
      setActivity({ type: "NOTE", subject: "", body: "" });
      invalidate();
    },
    onError: (err: Error) => toast({ type: "error", title: "Failed to log activity", description: err.message }),
  });

  const leads = leadsData?.items ?? [];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM pipeline</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {pipeline ? `${pipeline.totals.leads} leads · ${formatCurrency(pipeline.totals.value)} pipeline value` : "Track leads from first touch to won client."}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New lead
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={4} className="h-96 w-72 shrink-0" />)}
        </div>
      ) : !leadsData || leads.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No leads yet"
          description="Add your first lead to start building the pipeline."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New lead</Button>}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage.value);
            const stageValue = stageLeads.reduce((sum, l) => sum + (l.value ?? 0), 0);
            return (
              <div key={stage.value} className="w-72 shrink-0">
                <div className="mb-3 flex items-center justify-between rounded-xl border border-white/6 bg-white/3 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STAGE_COLORS[stage.value]}`} />
                    <span className="text-sm font-semibold">{stage.label}</span>
                  </div>
                  <span className="text-xs text-slate-400">{stageLeads.length} · {formatCurrency(stageValue)}</span>
                </div>
                <div className="space-y-2.5">
                  {stageLeads.map((l) => (
                    <Card key={l.id} className="card-hover p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={l.name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{l.name}</p>
                            <p className="truncate text-[11px] text-slate-400">
                              {l.company || l.source || "—"} {l.owner ? `· ${l.owner.name.split(" ")[0]}` : ""}
                            </p>
                          </div>
                        </div>
                        {l.score >= 70 && <Star className="h-4 w-4 text-amber-400" />}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="font-semibold text-brand-600 dark:text-brand-400">{l.value ? formatCurrency(l.value) : "—"}</span>
                        <span className="text-slate-400">{timeAgo(l.updatedAt)}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Select
                          value={l.stage}
                          onChange={(e) => setStage.mutate({ id: l.id, stage: e.target.value })}
                          className="h-8 text-xs"
                        >
                          {STAGES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </Select>
                        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setActiveId(l.id)}>
                          <MessageSquare className="h-3.5 w-3.5" /> View
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {stageLeads.length === 0 && (
                    <p className="rounded-xl border border-dashed border-white/8 py-6 text-center text-xs text-slate-500">No leads</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create lead */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="New lead" description="Add a prospect to the pipeline.">
        <div className="space-y-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@email.com" />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555-0100" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source">
              <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {["website", "referral", "facebook", "walk-in", "cold-call"].map((s) => (
                  <option key={s} value={s}>{s.replace("-", " ")}</option>
                ))}
              </Select>
            </Field>
            <Field label="Deal value ($)">
              <Input type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="499" />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Context about this lead…" />
          </Field>
          <Button className="w-full" loading={create.isPending} disabled={!form.name} onClick={() => create.mutate()}>
            Create lead
          </Button>
        </div>
      </Dialog>

      {/* Lead detail */}
      <Dialog open={Boolean(activeId)} onClose={() => setActiveId(null)} title={active?.name ?? "Lead"} description={active ? `${active.email ?? "no email"} · ${active.phone ?? "no phone"}` : undefined}>
        {active && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="neutral">{active.source ?? "—"} source</Badge>
              <Badge variant="success">{active.value ? formatCurrency(active.value) : "No value"}</Badge>
              {active.wonAt && <Badge variant="success">Won {timeAgo(active.wonAt)}</Badge>}
            </div>
            {active.notes && (
              <p className="rounded-xl border border-white/6 bg-white/3 p-3 text-sm text-slate-500 dark:text-slate-400">{active.notes}</p>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Activity timeline</p>
              <div className="space-y-2.5">
                {active.activities && active.activities.length > 0 ? (
                  active.activities.map((a) => (
                    <div key={a.id} className="rounded-xl border border-white/6 bg-white/3 p-3">
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="neutral">{a.type.toLowerCase()}</Badge>
                        <span className="font-medium">{a.subject}</span>
                        <span className="ml-auto text-slate-400">{timeAgo(a.createdAt)}</span>
                      </div>
                      {a.body && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{a.body}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No activity yet.</p>
                )}
              </div>
            </div>
            <div className="space-y-3 border-t border-white/6 pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Type">
                  <Select value={activity.type} onChange={(e) => setActivity({ ...activity, type: e.target.value })}>
                    {["NOTE", "CALL", "EMAIL", "SMS", "MEETING"].map((t) => (
                      <option key={t} value={t}>{t.toLowerCase()}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Subject" className="sm:col-span-2">
                  <Input value={activity.subject} onChange={(e) => setActivity({ ...activity, subject: e.target.value })} placeholder="Call to discuss program" />
                </Field>
              </div>
              <Textarea rows={2} value={activity.body} onChange={(e) => setActivity({ ...activity, body: e.target.value })} placeholder="Notes from the interaction…" />
              <Button className="w-full" loading={addActivity.isPending} disabled={!activity.subject} onClick={() => addActivity.mutate()}>
                Log activity
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
