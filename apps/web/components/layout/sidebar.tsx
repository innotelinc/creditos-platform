"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { useAuth, useRole } from "@/lib/auth";
import {
  Dashboard,
  FileText,
  Gavel,
  Mail,
  Settings,
  Shield,
  Document,
  Users,
  CreditCard,
} from "@/components/ui/icons";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { session } = useAuth();
  const { isAdmin, isStaff } = useRole();

  const items = [
    { href: "/dashboard", label: "Dashboard", icon: Dashboard },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/disputes", label: "Disputes", icon: Gavel },
    { href: "/letters", label: "Letters", icon: Mail },
    { href: "/documents", label: "Documents", icon: Document },
  ];
  if (isStaff) items.push({ href: "/crm", label: "CRM", icon: Users });
  if (isAdmin) items.push({ href: "/admin", label: "Admin", icon: Shield });
  if (isAdmin) items.push({ href: "/billing", label: "Billing", icon: CreditCard });
  items.push({ href: "/settings", label: "Settings", icon: Settings });

  const tenant = session?.tenant;

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
        <Link href="/dashboard" onClick={onClose}>
          <Logo />
        </Link>
        <button className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 md:hidden" onClick={onClose} aria-label="Close menu">
          ✕
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "text-brand-700 dark:text-brand-300"
                  : "text-slate-600 hover:bg-slate-500/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-500/12 to-violet-500/6 ring-1 ring-brand-500/15"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className="relative z-10 h-[18px] w-[18px]" />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-4">
        {tenant && (
          <div className="rounded-xl bg-white/40 p-3 dark:bg-white/4">
            <p className="truncate text-xs font-semibold">{tenant.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {tenant.plan}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="glass-strong fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/5 lg:block">
        {content}
      </aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="glass-strong absolute inset-y-0 left-0 w-64 border-r border-white/5"
          >
            {content}
          </motion.aside>
        </div>
      )}
    </>
  );
}
