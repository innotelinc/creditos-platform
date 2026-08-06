"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              const status = (error as { status?: number })?.status;
              if (status === 401 || status === 403) return false;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [theme, setTheme] = React.useState<"light" | "dark">("dark");

  React.useEffect(() => {
    const stored = localStorage.getItem("creditos-theme") as "light" | "dark" | null;
    if (stored) setTheme(stored);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("creditos-theme", next);
      return next;
    });
  };

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>
          <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

const ThemeContext = React.createContext<{ theme: "light" | "dark"; toggleTheme: () => void } | null>(null);

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within Providers");
  return ctx;
}
