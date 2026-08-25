"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StudentTodoItem = {
  key: string;
  title: string;
  href: string;
  tag: string;
};

const PAGE_SIZE = 3;

export function StudentTodoList({ items }: { items: StudentTodoItem[] }) {
  const [start, setStart] = useState(0);
  const maxStart = Math.max(0, items.length - PAGE_SIZE);
  const pageStart = Math.min(start, maxStart);
  const visible = items.slice(pageStart, pageStart + PAGE_SIZE);
  const canUp = pageStart > 0;
  const canDown = pageStart + PAGE_SIZE < items.length;

  return (
    <Card
      className={cn(
        "flex shrink-0 flex-col gap-3 overflow-visible rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-4",
        "desktop:h-auto",
      )}
    >
      {/* Mobile: lista + setas à direita */}
      <div className="flex min-h-0 items-stretch gap-2 desktop:hidden">
        <ul
          className={cn(
            "min-w-0 flex-1 space-y-2",
            // Altura para 3 botões completos — não corta o 3.º
            "min-h-[calc(3*4.25rem+2*0.5rem)]",
          )}
        >
          {visible.map((t) => (
            <TodoRow key={t.key} item={t} />
          ))}
        </ul>

        <div className="flex h-[calc(3*4.25rem+2*0.5rem)] shrink-0 flex-col items-center justify-between self-start desktop:hidden">
          <button
            type="button"
            aria-label="Itens anteriores"
            disabled={!canUp}
            onClick={() => setStart((s) => Math.max(0, s - 1))}
            className={cn(
              "grid size-9 place-items-center rounded-full text-muted-foreground transition-colors",
              canUp
                ? "hover:bg-white/10 hover:text-foreground active:bg-white/15"
                : "cursor-not-allowed opacity-30",
            )}
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Próximos itens"
            disabled={!canDown}
            onClick={() => setStart((s) => Math.min(maxStart, s + 1))}
            className={cn(
              "grid size-9 place-items-center rounded-full text-muted-foreground transition-colors",
              canDown
                ? "hover:bg-white/10 hover:text-foreground active:bg-white/15"
                : "cursor-not-allowed opacity-30",
            )}
          >
            <ArrowDown className="size-4" />
          </button>
        </div>
      </div>

      {/* Desktop: lista completa, sem setas */}
      <ul className="hidden space-y-2 desktop:block">
        {items.map((t) => (
          <TodoRow key={t.key} item={t} />
        ))}
      </ul>
    </Card>
  );
}

function TodoRow({ item }: { item: StudentTodoItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="group flex min-h-[4.25rem] items-center rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 transition-colors hover:bg-white/[0.06]"
      >
        <div className="flex w-full items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--neuma-coral)]">
              {item.tag}
            </p>
            <p className="mt-0.5 truncate text-[0.9375rem] font-semibold tracking-tight">
              {item.title}
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </Link>
    </li>
  );
}
