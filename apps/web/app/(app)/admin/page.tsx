"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type AuditEntry, type User } from "@/lib/api";
import { useRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { Tabs } from "@/components/ui/tabs";
import { timeAgo, cn } from "@/lib/utils";
import { Plus, Shield, Users, ScrollText } from "@/components/ui/icons";

const ROLES = ["CLIENT", "CREDIT_SPECIALIST", "DISPUTE_SPECIALIST", "ATTORNEY", "ADMIN"];

export default function AdminPage() {
  const { isAdmin } = useRole();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = React.useState("users");
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", password: "", role: "CREDIT_SPECIALIST" });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<{ items: User[]; total: number }>("/users"),
    enabled: isAdmin,
  });

  const { data: audit } = useQuery({
    queryKey: ["audit"],
    queryFn: () => api.get<{ items: AuditEntry[]; total: number }>("/audit?limit=30"),
    enabled: isAdmin && tab === "audit",
  });

  const { data: tenant } = useQuery({
    queryKey: ["tenant-me"],
    queryFn: () => api.get<{ name: string; slug: string; plan: string; brandColor: string | null }>("/tenants/me"),
    enabled: isAdmin && tab === "tenant",
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.patch(`/users/${id}/role`, { role }),
    onSuccess: () => {
      toast({ type: "success", title: "Role updated" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/users/${id}/status`, { status: status === "ACTIVE" ? "DISABLED" : "ACTIVE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ type: "success", title: "User status updated" });
    },
  });

  const invite = useMutation({
    mutationFn: () => api.post<User>("/users", form),
    onSuccess: () => {
      toast({ type: "success", title: "User created" });
      setInviteOpen(false);
      setForm({ name: "", email: "", password: "", role: "CREDIT_SPECIALIST" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast({ type: "error", title: "Failed", description: e.message }),
  });

  const [brandColor, setBrandColor] = React.useState("#6366f1");
  const saveBranding = useMutation({
    mutationFn: () => api.patch("/tenants/me", { brandColor }),
    onSuccess: () => {
      toast({ type: "success", title: "Branding updated" });
      qc.invalidateQueries({ queryKey: ["tenant-me"] });
    },
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-slate-400">You need admin access to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Users, roles, audit trail and agency branding.</p>
      </motion.div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "users", label: "Users" },
          { value: "audit", label: "Audit trail" },
          { value: "tenant", label: "Agency" },
        ]}
      />

      {tab === "users" && (
        <>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <Plus className="h-4 w-4" /> Add user
            </Button>
          </div>
          {isLoading ? (
            <SkeletonCard lines={4} className="h-72" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {users?.items.map((u) => (
                    <div key={u.id} className="flex flex-wrap items-center gap-4 p-4">
                      <Avatar name={u.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {u.name}
                          {u.isSuperAdmin && <span className="ml-2 text-[11px] font-bold text-amber-500">SUPER ADMIN</span>}
                        </p>
                        <p className="truncate text-xs text-slate-400">{u.email}</p>
                      </div>
                      <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
                      <Select
                        className="h-8 w-44 text-xs"
                        value={u.role}
                        disabled={u.isSuperAdmin}
                        onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r.replace("_", " ")}</option>
                        ))}
                      </Select>
                      {!u.isSuperAdmin && (
                        <Button variant="ghost" size="sm" onClick={() => toggleStatus.mutate({ id: u.id, status: u.status })}>
                          {u.status === "ACTIVE" ? "Disable" : "Enable"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "audit" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-4 w-4" /> Audit trail
            </CardTitle>
            <CardDescription>Immutable record of significant actions in your tenant</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[560px] space-y-2 overflow-y-auto scrollbar-thin">
            {audit?.items.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/3 p-3">
                <Avatar name={a.user?.name ?? "System"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{a.action}</span>
                    {a.entity && <span className="text-slate-400"> · {a.entity}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {a.user ? `${a.user.name} (${a.user.role})` : "System"} · {timeAgo(a.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            {audit?.items.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No audit entries yet.</p>}
          </CardContent>
        </Card>
      )}

      {tab === "tenant" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Agency branding
              </CardTitle>
              <CardDescription>Applied across your white-label workspace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Agency name">
                <Input defaultValue={tenant?.name} disabled placeholder={tenant?.name} />
              </Field>
              <Field label="Brand color">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                    aria-label="Brand color"
                  />
                  <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-28 font-mono" />
                </div>
              </Field>
              <Button loading={saveBranding.isPending} onClick={() => saveBranding.mutate()}>
                Save branding
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workspace stats</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {[
                ["Plan", tenant?.plan ?? "—"],
                ["Slug", tenant?.slug ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/4 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{k}</p>
                  <p className="mt-1 text-sm font-bold">{v}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} title="Add user" description="Creates an account with the chosen role in your agency.">
        <div className="space-y-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jordan Lee" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jordan@agency.com" />
          </Field>
          <Field label="Temporary password">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8+ characters" />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.filter((r) => r !== "CLIENT").map((r) => (
                <option key={r} value={r}>{r.replace("_", " ")}</option>
              ))}
            </Select>
          </Field>
          <Button className="w-full" loading={invite.isPending} disabled={!form.name || !form.email || form.password.length < 8} onClick={() => invite.mutate()}>
            <Users className="h-4 w-4" /> Create user
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
