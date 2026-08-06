"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, AlertTriangle, X, Sparkles } from "@/components/ui/icons";

type ToastType = "success" | "error" | "info";
interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

const ToastContext = React.createContext<{
  toast: (t: Omit<Toast, "id">) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles: Record<ToastType, { icon: React.ReactNode; ring: string }> = {
  success: { icon: <Check className="h-4 w-4 text-emerald-400" />, ring: "ring-emerald-500/30" },
  error: { icon: <AlertTriangle className="h-4 w-4 text-rose-400" />, ring: "ring-rose-500/30" },
  info: { icon: <Sparkles className="h-4 w-4 text-brand-400" />, ring: "ring-brand-500/30" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const toast = React.useCallback((t: Omit<Toast, "id">) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 24, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={cn(
                "glass-strong pointer-events-auto flex items-start gap-3 rounded-xl p-4 shadow-2xl shadow-slate-900/15 ring-1",
                styles[t.type].ring,
              )}
              role="status"
            >
              <span className="mt-0.5 shrink-0">{styles[t.type].icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.description}</p>}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-500/10"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
