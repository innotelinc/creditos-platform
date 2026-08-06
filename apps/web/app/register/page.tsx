"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { AuthShell } from "@/components/layout/auth-shell";
import { Tabs } from "@/components/ui/tabs";
import { Building, User } from "@/components/ui/icons";

const schema = z.object({
  model: z.enum(["BUSINESS", "CONSUMER"]),
  tenantName: z.string().min(2, "Agency name is required"),
  tenantSlug: z
    .string()
    .regex(/^[a-z0-9-]{2,32}$/, "2–32 chars: lowercase letters, numbers, dashes"),
  name: z.string().min(2, "Your name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

type Form = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { model: "BUSINESS", tenantName: "", tenantSlug: "" },
  });

  const model = watch("model");
  const tenantName = watch("tenantName");

  React.useEffect(() => {
    if (tenantName && !watch("tenantSlug")) {
      setValue("tenantSlug", slugify(tenantName));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantName]);

  const onSubmit = async (values: Form) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(Array.isArray(data.message) ? data.message.join(", ") : (data.message ?? "Registration failed"));
      }
      await refresh();
      toast({ type: "success", title: "Account created", description: "Welcome to CreditOS." });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast({ type: "error", title: "Registration failed", description: (err as Error).message });
    }
  };

  return (
    <AuthShell wide>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {model === "BUSINESS"
            ? "Set up your agency workspace — 3-day free trial included."
            : "Start your credit repair journey — 3-day free trial included."}
        </p>
      </div>

      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">I am a…</p>
        <Tabs
          value={model}
          onChange={(v) => setValue("model", v as "BUSINESS" | "CONSUMER")}
          tabs={[
            { value: "BUSINESS", label: "Credit repair agency" },
            { value: "CONSUMER", label: "Consumer / client" },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Agency name" error={errors.tenantName?.message}>
          <Input placeholder="Summit Credit Solutions" {...register("tenantName")} />
        </Field>
        <Field label="Agency slug" error={errors.tenantSlug?.message} hint="Used in your workspace URL">
          <Input placeholder="summit-credit" {...register("tenantSlug")} />
        </Field>
        <Field label="Your name" error={errors.name?.message}>
          <Input placeholder="Alex Rivera" {...register("name")} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" placeholder="you@agency.com" {...register("email")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Password" error={errors.password?.message} hint="8+ characters">
            <Input type="password" placeholder="••••••••" {...register("password")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
            {model === "BUSINESS" ? "Create workspace" : "Start free trial"}
          </Button>
        </div>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
