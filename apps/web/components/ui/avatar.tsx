import { cn, initials } from "@/lib/utils";

const palette = [
  "from-indigo-500 to-violet-500",
  "from-cyan-500 to-blue-500",
  "from-fuchsia-500 to-purple-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
];

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-base" };
  const hash = [...name].reduce((a, c) => a + (c.charCodeAt(0) || 0), 0);
  const grad = palette[hash % palette.length];

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- remote avatars (arbitrary URLs)
    return (
      <img
        src={src}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover ring-2 ring-white/40", sizes[size], className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-white/40",
        grad,
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
