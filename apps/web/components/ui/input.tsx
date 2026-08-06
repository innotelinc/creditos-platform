import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-slate-300/70 bg-white/70 px-3.5 py-2 text-sm text-slate-900 shadow-sm transition-all",
        "placeholder:text-slate-400 focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[100px] w-full rounded-xl border border-slate-300/70 bg-white/70 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all",
        "placeholder:text-slate-400 focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none",
        "dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Input, Textarea };
