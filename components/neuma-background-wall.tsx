import { cn } from "@/lib/utils";

/**
 * Parede visual partilhada — app, splash e login (via layout raiz).
 */
export function NeumaBackgroundWall({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("neuma-bg", className)}>
      <div aria-hidden className="neuma-bg-photo" />
      <div aria-hidden className="neuma-bg-neuma neuma-bg-neuma--top" />
      <div aria-hidden className="neuma-bg-neuma neuma-bg-neuma--bottom" />
    </div>
  );
}
