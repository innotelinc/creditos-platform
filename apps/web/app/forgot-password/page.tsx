"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { AuthShell } from "@/components/layout/auth-shell";
import { Check } from "@/components/ui/icons";

const schema = z.object({ email: z.string().email("Enter a valid email") });

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [sent, setSent] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: { email: string }) => {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setSent(true);
    } else {
      toast({ type: "error", title: "Request failed", description: "Please try again." });
    }
  };

  return (
    <AuthShell>
      {sent ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-500">
            <Check className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">Check your inbox</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            If an account exists for that email, a password reset link is on its way. The link expires in 15 minutes.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              We&apos;ll email you a secure reset link (check MailHog in local dev).
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" placeholder="you@agency.com" {...register("email")} />
            </Field>
            <Button type="submit" loading={isSubmitting} className="w-full">
              Send reset link
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
