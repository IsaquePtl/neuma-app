"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** UTC instant when Europe/Lisbon reads 00:00 on this calendar day. */
function lisbonMidnight(isoDate: string): number {
  const utcGuess = Date.parse(`${isoDate}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Lisbon",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcGuess));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second"),
  );
  return utcGuess - (asUtc - utcGuess);
}

function splitRemaining(targetMs: number, now: number) {
  const total = Math.max(0, Math.floor((targetMs - now) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function LevelCountdown({
  opensOn,
  variant = "units",
  className,
}: {
  /** YYYY-MM-DD, the Monday the level opens. */
  opensOn: string;
  variant?: "units" | "compact" | "stage";
  className?: string;
}) {
  const target = lisbonMidnight(opensOn);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const left = splitRemaining(target, now);

  if (variant === "compact") {
    return (
      <span className={cn("tabular-nums", className)} suppressHydrationWarning>
        {left.days}d {pad(left.hours)}:{pad(left.minutes)}:{pad(left.seconds)}
      </span>
    );
  }

  const units = [
    { value: left.days, label: left.days === 1 ? "dia" : "dias" },
    { value: left.hours, label: "horas" },
    { value: left.minutes, label: "min" },
    { value: left.seconds, label: "seg" },
  ];

  if (variant === "stage") {
    return (
      <div className={cn("min-w-0", className)}>
        <div className="grid grid-cols-4">
          {units.map((unit, index) => (
            <div
              key={unit.label}
              className={cn(
                "flex min-w-0 justify-center",
                index > 0 && "border-l border-white/10",
              )}
            >
              <div className="inline-grid justify-items-center">
                <p
                  className={cn(
                    "col-start-1 row-start-1 mb-2 w-0 min-w-0 justify-self-start overflow-visible whitespace-nowrap text-left text-[11px] font-medium uppercase tracking-[0.22em]",
                    index === 0 ? "text-muted-foreground" : "invisible",
                  )}
                >
                  Faltam
                </p>
                <span
                  className="col-start-1 row-start-2 font-heading text-xl font-bold leading-none tabular-nums text-foreground sm:text-2xl"
                  suppressHydrationWarning
                >
                  {pad(unit.value)}
                </span>
                <span className="col-start-1 row-start-3 mt-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {unit.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Faltam
      </p>
      <div className="flex gap-1.5">
        {units.map((unit) => (
          <div
            key={unit.label}
            className="grid min-w-[2.75rem] place-items-center rounded-xl bg-black/30 px-1.5 py-1.5"
          >
            <span
              className="font-heading text-lg font-bold tabular-nums leading-none text-foreground"
              suppressHydrationWarning
            >
              {pad(unit.value)}
            </span>
            <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-foreground/70">
              {unit.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
