export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11 rounded-2xl" : size === "sm" ? "h-8 w-8 rounded-xl" : "h-9 w-9 rounded-xl";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`${box} flex items-center justify-center bg-gradient-to-br from-brand-500 via-violet-500 to-cyan-400 font-bold text-white shadow-lg shadow-brand-600/30`}
        aria-hidden="true"
      >
        <span className={text}>C</span>
      </span>
      <span className={`font-display font-bold tracking-tight ${size === "lg" ? "text-2xl" : "text-lg"}`}>
        Credit<span className="text-gradient">OS</span>
      </span>
    </span>
  );
}
