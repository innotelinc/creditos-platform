"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Mail, Check } from "@/components/ui/icons";

const schema = z.object({
  name: z.string().min(1, "Your name is required"),
  email: z.string().email("Enter a valid email"),
  subject: z.string().min(1, "Add a subject"),
  message: z.string().min(5, "Tell us a bit more (at least 5 characters)"),
});

type Form = z.infer<typeof schema>;

export default function ContactPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (values: Form) => {
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Message failed to send");
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Talk to us</h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-500 dark:text-slate-400">
            Sales questions, partnership ideas, or a dispute your agency needs help with — we reply within one business day.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="glass-strong mt-10 rounded-3xl p-8 sm:p-10">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500"><Check className="h-7 w-7" /></div>
              <h2 className="text-xl font-bold">Message sent</h2>
              <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
                Thanks for reaching out — we will get back to you shortly. For immediate help, browse the help center.
              </p>
              <Link href="/knowledge-base" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">Browse the help center</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" error={errors.name?.message}>
                  <Input placeholder="Jane Doe" autoComplete="name" {...register("name")} />
                </Field>
                <Field label="Email" error={errors.email?.message}>
                  <Input type="email" placeholder="jane@agency.com" autoComplete="email" {...register("email")} />
                </Field>
              </div>
              <Field label="Subject" error={errors.subject?.message}>
                <Input placeholder="How can we help?" {...register("subject")} />
              </Field>
              <Field label="Message" error={errors.message?.message}>
                <Textarea rows={6} placeholder="Tell us about your agency, your credit situation, or your question…" {...register("message")} />
              </Field>
              {error && <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-500">{error}</p>}
              <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
                <Mail className="h-4 w-4" /> Send message
              </Button>
            </form>
          )}
        </motion.div>
      </section>
    </MarketingShell>
  );
}
