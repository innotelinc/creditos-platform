"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type Notification } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/providers";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, timeAgo } from "@/lib/utils";
import { Bell, Menu, LogOut, Settings, Sparkles } from "@/components/ui/icons";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { session, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = React.useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ items: Notification[]; unread: number }>("/notifications"),
    refetchInterval: 45_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`, {}),
    onSuccess: () => refetch(),
  });

  const unread = data?.unread ?? 0;

  return (
    <header className="glass-strong sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/5 px-4 sm:px-6">
      <button className="rounded-lg p-2 text-slate-500 hover:bg-white/5 lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden items-center gap-2 md:flex">
        <Badge variant="violet">
          <Sparkles className="h-3 w-3" /> AI Analysis
        </Badge>
        {session?.tenant && (
          <Badge variant="neutral">{session.tenant.name}</Badge>
        )}
      </div>

      <div className="flex-1" />

      <button
        onClick={toggleTheme}
        className="relative h-9 w-9 rounded-xl border border-white/8 bg-white/4 text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
        aria-label="Toggle theme"
      >
        <span className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-base leading-none transition-all", theme === "dark" ? "opacity-0" : "opacity-100")}>☀️</span>
        <span className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-base leading-none transition-all", theme === "dark" ? "opacity-100" : "opacity-0")}>🌙</span>
      </button>

      <button
        onClick={() => setNotifOpen(true)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Dropdown
        align="right"
        trigger={({ open }) => (
          <button
            className={cn("flex items-center gap-2.5 rounded-xl p-1 pr-2 transition-colors hover:bg-white/5", open && "bg-white/5")}
            aria-label="Account menu"
          >
            <Avatar name={session?.user.name ?? "?"} />
            <span className="hidden text-left sm:block">
              <span className="block max-w-[140px] truncate text-sm font-semibold leading-tight">{session?.user.name}</span>
              <span className="block text-[11px] capitalize leading-tight text-slate-400">
                {session?.user.role.toLowerCase().replace("_", " ")}
              </span>
            </span>
          </button>
        )}
        items={[
          {
            label: "Settings",
            onClick: () => router.push("/settings"),
            icon: <Settings className="h-4 w-4" />,
          },
          {
            label: "Sign out",
            onClick: () => void logout(),
            icon: <LogOut className="h-4 w-4" />,
            danger: true,
          },
        ]}
      />

      <Dialog
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up"}
      >
        {data ? (
          <div className="space-y-2.5">
            {data.items.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No notifications yet</p>
            )}
            {data.items.slice(0, 8).map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "/dashboard"}
                onClick={() => {
                  if (!n.readAt) markRead.mutate(n.id);
                  setNotifOpen(false);
                }}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-white/6 bg-white/3 p-3 transition-colors hover:bg-white/6",
                  !n.readAt && "border-brand-500/25 bg-brand-500/5",
                )}
              >
                <div className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", !n.readAt ? "bg-brand-500" : "bg-slate-400/50")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-slate-500">{timeAgo(n.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
      </Dialog>
    </header>
  );
}
