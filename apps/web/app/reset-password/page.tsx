"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { AuthShell } from "@/components/layout/auth-shell";
import { Check } from "@/components/ui/icons";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

function ResetForm() {
  const params = useSearchParams();
  const token = params?.get("token") ?? "";
  const { toast } = useToast();
  const [done, setDone] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ password: string; confirm: string }>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: { password: string }) => {
    if (!token) {
      toast({ type: "error", title: "Missing reset token", description: "Open the link from your email." });
      return;
    }
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: values.password }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ type: "error", title: "Reset failed", description: Array.isArray(data.message) ? data.message.join(", ") : (data.message ?? "Invalid token") });
      return;
    }
    setDone(true);
  };

  return (
    <AuthShell>
      {done ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-500">
            <Check className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">Password updated</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">All your other sessions were signed out.</p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
            Sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Make it at least 8 characters.</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="New password" error={errors.password?.message}>
              <Input type="password" placeholder="••••••••" {...register("password")} />
            </Field>
            <Field label="Confirm password" error={errors.confirm?.message}>
              <Input type="password" placeholder="••••••••" {...register("confirm")} />
            </Field>
            <Button type="submit" loading={isSubmitting} className="w-full">
              Update password
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<AuthShell><p className="py-10 text-center text-sm text-slate-400">Loading…</p></AuthShell>}>
      <ResetForm />
    </React.Suspense>
  );
}
