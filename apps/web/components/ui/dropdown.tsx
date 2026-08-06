"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
}

export function Dropdown({
  trigger,
  items,
  align = "right",
}: {
  trigger: (props: { open: boolean }) => React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger({ open })}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            className={cn(
              "glass-strong absolute z-40 mt-2 min-w-[190px] overflow-hidden rounded-xl p-1.5 shadow-xl shadow-slate-900/10",
              align === "right" ? "right-0" : "left-0",
            )}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            role="menu"
          >
            {items.map((item, i) => (
              <button
                key={i}
                role="menuitem"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  item.danger
                    ? "text-rose-500 hover:bg-rose-500/10"
                    : "text-slate-700 hover:bg-brand-500/10 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-300",
                )}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
