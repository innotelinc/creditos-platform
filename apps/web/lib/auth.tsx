"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, type AuthSession } from "@/lib/api";

interface AuthState {
  session: AuthSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();

  const refresh = React.useCallback(async () => {
    try {
      const data = await api.get<AuthSession>("/auth/me");
      setSession(data);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = React.useCallback(async () => {
    try {
      await api.post("/auth/logout", {});
    } catch {
      /* ignore */
    }
    setSession(null);
    router.replace("/login");
    router.refresh();
  }, [router]);

  return <AuthContext.Provider value={{ session, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRole() {
  const { session } = useAuth();
  const role = session?.user.role ?? "";
  return {
    role,
    isClient: role === "CLIENT",
    isStaff: ["CREDIT_SPECIALIST", "DISPUTE_SPECIALIST", "ATTORNEY", "ADMIN", "SUPER_ADMIN"].includes(role),
    isAdmin: role === "ADMIN" || role === "SUPER_ADMIN",
    isSuperAdmin: role === "SUPER_ADMIN",
  };
}
