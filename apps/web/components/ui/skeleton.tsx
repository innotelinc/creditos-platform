import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-lg bg-slate-200/60 dark:bg-white/5", className)} {...props} />;
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("glass space-y-3 rounded-2xl p-6", className)} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-4/5" />
      ))}
    </div>
  );
}
