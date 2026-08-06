"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type Dispute, type User } from "@/lib/api";
import { useRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ComplianceBanner } from "@/components/ui/compliance-banner";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { Tabs } from "@/components/ui/tabs";
import { timeAgo } from "@/lib/utils";
import { Gavel, Plus, ArrowRight } from "@/components/ui/icons";

export default function DisputesPage() {
  const { isStaff } = useRole();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({ clientId: "", title: "", priority: "MEDIUM", notes: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["disputes", tab],
    queryFn: () => api.get<{ items: Dispute[]; total: number }>(`/disputes${tab === "all" ? "" : `?status=${tab.toUpperCase()}`}`),
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<{ items: User[] }>("/users/clients"),
    enabled: isStaff,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<Dispute>("/disputes", {
        clientId: form.clientId,
        title: form.title,
        priority: form.priority,
        notes: form.notes || undefined,
      }),
    onSuccess: (d) => {
      toast({ type: "success", title: "Dispute created", description: "Round 1 starts when you attach a letter." });
      setCreateOpen(false);
      setForm({ clientId: "", title: "", priority: "MEDIUM", notes: "" });
      qc.invalidateQueries({ queryKey: ["disputes"] });
    },
    onError: (e: Error) => toast({ type: "error", title: "Could not create dispute", description: e.message }),
  });

  const statuses = ["all", "active", "pending_client", "resolved", "rejected"];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Disputes</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Rounds 1–3 with bureau response tracking.</p>
        </div>
        {isStaff && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New dispute
          </Button>
        )}
      </motion.div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={statuses.map((s) => ({
          value: s,
          label: s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()),
        }))}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} className="h-20" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Gavel className="h-6 w-6" />}
          title="No disputes here"
          description={tab === "all" ? "Start a dispute from a report analysis or create one manually." : `No ${tab} disputes.`}
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((d) => (
            <Link key={d.id} href={`/disputes/${d.id}`}>
              <Card className="card-hover flex items-center gap-4 p-4">
                <Avatar name={d.client.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{d.title}</p>
                    <Badge variant="violet">Round {d.currentRound}</Badge>
                    {d._count && d._count.letters > 0 && <Badge variant="neutral">{d._count.letters} letter(s)</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {d.client.name} · updated {timeAgo(d.updatedAt)}
                    {d.priority !== "MEDIUM" && <> · <span className={d.priority === "HIGH" || d.priority === "URGENT" ? "text-rose-400" : "text-amber-400"}>{d.priority} priority</span></>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(d.status)}>{d.status.replace("_", " ")}</Badge>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New dispute"
        description="A dispute tracks rounds 1–3. Attach letters as you generate them."
      >
        <div className="space-y-4">
          <Field label="Client">
            <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">Select client…</option>
              {clients?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.email}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title">
            <Input
              placeholder="Capital One Charge-Off — Furnisher Dispute"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea
              placeholder="Context for the dispute…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <Button
            className="w-full"
            loading={create.isPending}
            disabled={!form.clientId || !form.title}
            onClick={() => create.mutate()}
          >
            Create dispute
          </Button>
        </div>
      </Dialog>

      <ComplianceBanner />
    </div>
  );
}
