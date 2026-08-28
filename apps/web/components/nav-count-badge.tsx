import { cn } from "@/lib/utils";

export function NavCountBadge({
  count,
  active = false,
}: {
  count: number;
  active?: boolean;
}) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full px-1 text-[9px] font-semibold text-white",
        active ? "bg-white/25" : "bg-[var(--neuma-coral)]",
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
