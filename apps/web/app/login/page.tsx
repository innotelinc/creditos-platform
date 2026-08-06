"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { Lock } from "@/components/ui/icons";
import { AuthShell } from "@/components/layout/auth-shell";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  totpCode: z.string().length(6).optional().or(z.literal("")),
});

type Form = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <React.Suspense fallback={<AuthShell><p className="py-10 text-center text-sm text-slate-400">Loading…</p></AuthShell>}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [totpRequired, setTotpRequired] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Form) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          totpCode: values.totpCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.message === "object" && data.code === "TOTP_REQUIRED") {
          setTotpRequired(true);
          toast({ type: "info", title: "Two-factor code required", description: "Enter your 6-digit authenticator code." });
          return;
        }
        throw new Error(Array.isArray(data.message) ? data.message.join(", ") : (data.message ?? "Login failed"));
      }
      await refresh();
      toast({ type: "success", title: "Welcome back" });
      router.push(params.get("next") ?? "/dashboard");
      router.refresh();
    } catch (err) {
      toast({ type: "error", title: "Sign in failed", description: (err as Error).message });
    }
  };

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to your CreditOS workspace</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@agency.com" {...register("email")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
        </Field>
        {totpRequired && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
            <Field label="Two-factor code" error={errors.totpCode?.message} hint="From your authenticator app">
              <Input inputMode="numeric" maxLength={6} placeholder="123456" {...register("totpCode")} />
            </Field>
          </motion.div>
        )}
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
          <Lock className="h-4 w-4" /> Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        New to CreditOS?{" "}
        <Link href="/register" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Create an account
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-brand-500/15 bg-brand-500/5 p-3.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Demo workspace:</span> sign in with{" "}
        <code className="rounded bg-slate-200/60 px-1.5 py-0.5 text-[11px] dark:bg-white/8">client@summit.test</code> /{" "}
        <code className="rounded bg-slate-200/60 px-1.5 py-0.5 text-[11px] dark:bg-white/8">Password123!</code>
      </div>
    </AuthShell>
  );
}
