"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type ClientItem } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";
import { Plus, Users, FileText, MessageSquare, StickyNote, Trash2, RefreshCw, KeyRound } from "@/components/ui/icons";

const emptyForm = { name: "", email: "", phone: "", notes: "" };

export default function ClientsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editClient, setEditClient] = React.useState<ClientItem | null>(null);
  const [removeClient, setRemoveClient] = React.useState<ClientItem | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<{ items: ClientItem[] }>("/users/clients"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["clients"] });

  const create = useMutation({
    mutationFn: () =>
      api.post<{ user: ClientItem; temporaryPassword?: string }>("/users/clients", {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: (res) => {
      toast({ type: "success", title: "Client added", description: `${res.user.name} can now sign in to the client portal.` });
      setTempPassword(res.temporaryPassword ?? null);
      setForm(emptyForm);
      invalidate();
    },
    onError: (err: Error) => toast({ type: "error", title: "Could not add client", description: err.message }),
  });

  const save = useMutation({
    mutationFn: () =>
      api.patch<ClientItem>(`/users/clients/${editClient!.id}`, {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast({ type: "success", title: "Client updated" });
      setEditClient(null);
      invalidate();
    },
    onError: (err: Error) => toast({ type: "error", title: "Update failed", description: err.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/users/clients/${id}`),
    onSuccess: () => {
      toast({ type: "info", title: "Client removed", description: "Portal access disabled — history is kept." });
      setRemoveClient(null);
      invalidate();
    },
    onError: (err: Error) => toast({ type: "error", title: "Could not remove client", description: err.message }),
  });

  const restore = useMutation({
    mutationFn: (id: string) => api.patch<ClientItem>(`/users/clients/${id}`, { status: "ACTIVE" }),
    onSuccess: () => {
      toast({ type: "success", title: "Client restored" });
      invalidate();
    },
    onError: (err: Error) => toast({ type: "error", title: "Restore failed", description: err.message }),
  });

  const openEdit = (c: ClientItem) => {
    setEditClient(c);
    setForm({ name: c.name, email: c.email, phone: c.phone ?? "", notes: c.notes ?? "" });
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setTempPassword(null);
    setForm(emptyForm);
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {items.length} client{items.length === 1 ? "" : "s"} · add, update notes, or remove portal access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add client
          </Button>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} lines={4} className="h-48" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No clients yet"
          description="Add your first client to start pulling reports and running disputes."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Add your first client
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} className="card-hover p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-slate-400">{c.email}</p>
                  </div>
                </div>
                <Badge variant={c.status === "ACTIVE" ? "success" : "neutral"}>
                  {c.status === "ACTIVE" ? "Active" : "Removed"}
                </Badge>
              </div>

              {c.notes && (
                <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-white/6 bg-white/3 p-2.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                  <span className="line-clamp-3">{c.notes}</span>
                </p>
              )}

              <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> {c._count?.reportsAsClient ?? 0} reports
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" /> {c._count?.disputesAsClient ?? 0} disputes
                </span>
                <span className="ml-auto">{c.lastLoginAt ? `Active ${timeAgo(c.lastLoginAt)}` : "Never signed in"}</span>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-white/6 pt-3">
                <Link href={`/reports?client=${c.id}`}>
                  <Button variant="outline" size="sm">
                    <FileText className="h-3.5 w-3.5" /> Reports
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                  <StickyNote className="h-3.5 w-3.5" /> Notes
                </Button>
                {c.status === "ACTIVE" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto border-rose-500/25 text-rose-500 hover:bg-rose-500/8"
                    onClick={() => setRemoveClient(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="ml-auto" onClick={() => restore.mutate(c.id)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Restore
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add client */}
      <Dialog
        open={createOpen}
        onClose={closeCreate}
        title="Add client"
        description="Creates a client portal account. A temporary password is generated unless you set one."
      >
        <div className="space-y-4">
          <Field label="Full name">
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
          <Field label="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Context about this client…" />
          </Field>

          {tempPassword ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <KeyRound className="h-4 w-4" /> Client created — share this one-time password
              </p>
              <code className="mt-2 block rounded-lg bg-white/6 px-3 py-2 text-sm font-bold tracking-wide">{tempPassword}</code>
              <p className="mt-2 text-xs text-slate-400">They can reset it anytime via “Forgot password”.</p>
            </div>
          ) : (
            <Button
              className="w-full"
              loading={create.isPending}
              disabled={!form.name || !form.email}
              onClick={() => create.mutate()}
            >
              <Plus className="h-4 w-4" /> Add client
            </Button>
          )}
        </div>
      </Dialog>

      {/* Edit notes/details */}
      <Dialog open={Boolean(editClient)} onClose={() => setEditClient(null)} title={`Edit ${editClient?.name ?? "client"}`} description="Update contact details and staff notes.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Dispute status, communication preferences, next steps…" />
          </Field>
          <Button className="w-full" loading={save.isPending} disabled={!form.name || !form.email} onClick={() => save.mutate()}>
            Save changes
          </Button>
        </div>
      </Dialog>

      {/* Remove confirm */}
      <Dialog
        open={Boolean(removeClient)}
        onClose={() => setRemoveClient(null)}
        title={`Remove ${removeClient?.name ?? "client"}?`}
        description="Their portal access is disabled immediately. All reports, disputes and history stay in the workspace — you can restore the client anytime."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRemoveClient(null)}>
            Cancel
          </Button>
          <Button variant="destructive" loading={remove.isPending} onClick={() => removeClient && remove.mutate(removeClient.id)}>
            <Trash2 className="h-4 w-4" /> Remove client
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
