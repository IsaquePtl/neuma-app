import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

import type {
  ActionNeededItem,
  ActionNeededKind,
} from "@/lib/mentor/action-needed";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  ActionNeededKind,
  {
    label: string;
    icon: LucideIcon;
    iconClass: string;
    chipClass: string;
  }
> = {
  session: {
    label: "Sessão",
    icon: CalendarDays,
    iconClass: "bg-[var(--neuma-coral)]/15 text-[var(--neuma-coral)]",
    chipClass: "text-[var(--neuma-coral)]",
  },
  checkin: {
    label: "Check-in",
    icon: ClipboardCheck,
    iconClass: "bg-sky-500/15 text-sky-300",
    chipClass: "text-sky-300",
  },
  overdue: {
    label: "Prazo",
    icon: AlertTriangle,
    iconClass: "bg-amber-500/15 text-amber-300",
    chipClass: "text-amber-300",
  },
  invite: {
    label: "1:1",
    icon: CreditCard,
    iconClass: "bg-violet-500/15 text-violet-300",
    chipClass: "text-violet-300",
  },
};

function ActionCard({ item }: { item: ActionNeededItem }) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const className = cn(
    "group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3.5",
    "transition-colors hover:border-white/16 hover:bg-white/[0.055]",
  );

  const body = (
    <>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          meta.iconClass,
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.14em]",
              meta.chipClass,
            )}
          >
            {meta.label}
          </span>
          {item.external ? (
            <ExternalLink
              className="size-3 text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          ) : null}
        </span>
        <span className="block text-sm font-medium leading-snug text-foreground">
          {item.title}
        </span>
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {item.detail}
        </span>
      </span>
    </>
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {body}
    </Link>
  );
}

export function ActionNeededList({ items }: { items: ActionNeededItem[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight">Exige acção</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nada atrasado nem check-ins à espera.
        </p>
      ) : (
        <ul className="grid gap-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <ActionCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
