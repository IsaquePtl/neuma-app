import { cn } from "@/lib/utils";

export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
  className,
  centerActions = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  centerActions?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass relative overflow-hidden rounded-3xl p-6 lg:p-7 animate-fade-up",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage: "url(/brand/neumas-white.png)",
          backgroundSize: "360px",
        }}
      />
      <div
        className={cn(
          "flex gap-4",
          centerActions
            ? "flex-col items-center text-center"
            : "flex-wrap items-end justify-between",
        )}
      >
        <div className="space-y-1.5">
          {eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p
              className={cn(
                "max-w-xl text-sm text-muted-foreground",
                centerActions && "mx-auto",
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {children ? (
          <div
            className={cn(
              centerActions ? "flex w-full justify-center" : "shrink-0",
            )}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
