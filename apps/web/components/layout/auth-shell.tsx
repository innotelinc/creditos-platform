"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/layout/logo";
import { Sparkles } from "@/components/ui/icons";

export function AuthShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="landing-bg flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`glass-strong w-full rounded-3xl p-8 shadow-2xl shadow-brand-900/10 sm:p-10 ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <Link href="/" className="mb-8 inline-flex items-center gap-2.5">
          <Logo />
        </Link>
        {children}
        <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <Sparkles className="h-3 w-3" />
          CreditOS · AI Credit Repair Operating System
        </div>
      </motion.div>
    </div>
  );
}
