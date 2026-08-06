import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "violet" | "neutral";

const variants: Record<BadgeVariant, string> = {
  default: "bg-brand-500/12 text-brand-600 ring-brand-500/25 dark:text-brand-300",
  success: "bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300",
  warning: "bg-amber-500/12 text-amber-600 ring-amber-500/25 dark:text-amber-300",
  danger: "bg-rose-500/12 text-rose-600 ring-rose-500/25 dark:text-rose-300",
  info: "bg-cyan-500/12 text-cyan-600 ring-cyan-500/25 dark:text-cyan-300",
  violet: "bg-violet-500/12 text-violet-600 ring-violet-500/25 dark:text-violet-300",
  neutral: "bg-slate-500/10 text-slate-600 ring-slate-500/25 dark:text-slate-300",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function statusVariant(status?: string): BadgeVariant {
  const s = (status ?? "").toLowerCase();
  if (["active", "sent", "delivered", "parsed", "analyzed", "analysed", "resolved", "done", "read", "ready"].some((k) => s.includes(k)))
    return "success";
  if (["pending", "parsing", "analyzing", "received", "in_progress", "todo", "draft"].some((k) => s.includes(k)))
    return "warning";
  if (["rejected", "failed", "disabled", "cancelled", "escalated"].some((k) => s.includes(k)))
    return "danger";
  if (["client", "specialist", "attorney", "admin", "super_admin", "dispute"].some((k) => s.includes(k)))
    return "violet";
  return "info";
}
