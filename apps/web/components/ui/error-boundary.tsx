"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "@/components/ui/icons";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/5 px-6 py-14 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold">Something went wrong</h3>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            {this.state.error.message || "An unexpected error occurred while rendering this view."}
          </p>
          <Button
            className="mt-5"
            variant="outline"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
