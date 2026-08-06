"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { timeAgo, cn } from "@/lib/utils";
import { Check, Lock, Shield, Sparkles, User } from "@/components/ui/icons";

const profileSchema = z.object({ name: z.string().min(2, "Name is required"), phone: z.string().optional() });
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z.string().min(8, "At least 8 characters"),
  });

export default function SettingsPage() {
  const { session, refresh } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [totpStep, setTotpStep] = React.useState<"idle" | "setup" | "verify">("idle");
  const [totpData, setTotpData] = React.useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [totpCode, setTotpCode] = React.useState("");

  const profile = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { name: session?.user.name ?? "", phone: session?.user.phone ?? "" },
  });

  const pwd = useForm<{ currentPassword: string; newPassword: string }>({ resolver: zodResolver(passwordSchema) });

  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api.get<{ items: { id: string; userAgent: string | null; ip: string | null; createdAt: string }[] }>("/auth/sessions"),
  });

  const saveProfile = useMutation({
    mutationFn: () => api.patch("/users/me", { name: profile.getValues("name"), phone: profile.getValues("phone") || undefined }),
    onSuccess: () => {
      toast({ type: "success", title: "Profile updated" });
      void refresh();
    },
    onError: (e: Error) => toast({ type: "error", title: "Failed", description: e.message }),
  });

  const changePassword = useMutation({
    mutationFn: () => api.post("/auth/change-password", pwd.getValues()),
    onSuccess: () => {
      toast({ type: "success", title: "Password changed", description: "Other sessions were signed out." });
      pwd.reset();
    },
    onError: (e: Error) => toast({ type: "error", title: "Failed", description: e.message }),
  });

  const generateTotp = useMutation({
    mutationFn: () => api.post<{ secret: string; otpauthUrl: string }>("/auth/totp/generate", {}),
    onSuccess: (d) => {
      setTotpData(d);
      setTotpStep("verify");
    },
  });

  const verifyTotp = useMutation({
    mutationFn: () => api.post("/auth/totp/verify", { code: totpCode }),
    onSuccess: () => {
      toast({ type: "success", title: "2FA enabled" });
      setTotpStep("idle");
      void refresh();
    },
    onError: (e: Error) => toast({ type: "error", title: "Invalid code", description: e.message }),
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Profile, security and workspace configuration.</p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardHeader className="flex-row items-center gap-4">
            <Avatar name={session?.user.name ?? "?"} size="lg" />
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>{session?.user.email}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={profile.handleSubmit(() => saveProfile.mutate())} className="space-y-4">
              <Field label="Full name" error={profile.formState.errors.name?.message}>
                <Input {...profile.register("name")} />
              </Field>
              <Field label="Phone" error={profile.formState.errors.phone?.message}>
                <Input placeholder="+1 555 000 0000" {...profile.register("phone")} />
              </Field>
              <Button type="submit" loading={saveProfile.isPending}>
                <User className="h-4 w-4" /> Save profile
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> Password
              </CardTitle>
              <CardDescription>Changing your password signs out all other devices</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={pwd.handleSubmit(() => changePassword.mutate())} className="space-y-4">
                <Field label="Current password" error={pwd.formState.errors.currentPassword?.message}>
                  <Input type="password" {...pwd.register("currentPassword")} />
                </Field>
                <Field label="New password" error={pwd.formState.errors.newPassword?.message}>
                  <Input type="password" {...pwd.register("newPassword")} />
                </Field>
                <Button type="submit" variant="outline" loading={changePassword.isPending}>
                  Update password
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Two-factor authentication
              </CardTitle>
              <CardDescription>
                {session?.user.totpEnabled ? "Enabled — codes required at sign-in" : "Add an extra layer of security"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {session?.user.totpEnabled ? (
                <Badge variant="success">
                  <Check className="h-3 w-3" /> 2FA active
                </Badge>
              ) : totpStep === "idle" ? (
                <Button variant="outline" loading={generateTotp.isPending} onClick={() => generateTotp.mutate()}>
                  <Shield className="h-4 w-4" /> Enable 2FA
                </Button>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed text-slate-400">
                    Scan this URI with your authenticator app (e.g. Google Authenticator), then enter the 6-digit code:
                  </p>
                  <div className="rounded-lg bg-white/4 p-3">
                    <code className="break-all text-[11px] text-brand-500">{totpData?.otpauthUrl}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="123456"
                      className="w-32"
                    />
                    <Button loading={verifyTotp.isPending} onClick={() => verifyTotp.mutate()}>
                      Verify
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Devices currently holding a refresh token</CardDescription>
        </CardHeader>
        <CardContent>
          {!sessions ? (
            <SkeletonCard lines={2} className="h-16" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sessions.items.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/3 p-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/12 text-brand-500">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.userAgent ?? "Unknown device"}</p>
                    <p className="text-xs text-slate-400">
                      {s.ip ?? "no IP"} · active {timeAgo(s.createdAt)}
                    </p>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
              ))}
              {sessions.items.length === 0 && <p className="text-sm text-slate-400">No active sessions.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> AI provider
          </CardTitle>
          <CardDescription>
            Analysis and letter generation are powered by your OpenAI-compatible proxy, with a deterministic local
            engine as automatic fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="violet">
            <Sparkles className="h-3 w-3" /> OpenRouter-compatible
          </Badge>
          <Badge variant="neutral">{process.env.NEXT_PUBLIC_AI_MODEL ?? "configured on the API"}</Badge>
          <p className="text-xs text-slate-400">
            Set <code className="rounded bg-white/6 px-1.5 py-0.5 text-[11px]">AI_API_KEY</code> and{" "}
            <code className="rounded bg-white/6 px-1.5 py-0.5 text-[11px]">AI_BASE_URL</code> on the API container.
            Without a key, the built-in deterministic engine analyzes reports and drafts letters locally.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
