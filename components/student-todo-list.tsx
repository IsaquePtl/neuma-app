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
  const showArrows = items.length > PAGE_SIZE;

  return (
    <Card
      className={cn(
        "neuma-accent-top flex shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] px-5 pb-3.5 pt-7",
        // Mobile/tablet: altura fixa para 3 slots (+ setas se necessário)
        showArrows
          ? "h-[calc(3.5rem+1.75rem+3*4rem+2*0.5rem+2.75rem)]"
          : "h-[calc(3.5rem+1.75rem+3*4rem+2*0.5rem)]",
        // Desktop: cresce com o conteúdo, sem setas
        "desktop:h-auto",
      )}
    >
      <p className="mb-1 shrink-0 pl-1 text-[0.8125rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        To do list
      </p>

      {showArrows ? (
        <button
          type="button"
          aria-label="Itens anteriores"
          disabled={!canUp}
          onClick={() => setStart((s) => Math.max(0, s - 1))}
          className={cn(
            "mx-auto grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors desktop:hidden",
            canUp
              ? "hover:bg-white/10 hover:text-foreground"
              : "pointer-events-none opacity-25",
          )}
        >
          <ArrowUp className="size-4" />
        </button>
      ) : null}

      {/* Mobile: só a página de 3; sem scroll por gesto */}
      <ul
        className={cn(
          "min-h-0 space-y-2 overflow-hidden overscroll-none",
          "desktop:hidden",
        )}
      >
        {visible.map((t) => (
          <TodoRow key={t.key} item={t} />
        ))}
      </ul>

      {/* Desktop: lista completa, sem paginação */}
      <ul className="hidden space-y-2 desktop:block">
        {items.map((t) => (
          <TodoRow key={t.key} item={t} />
        ))}
      </ul>

      {showArrows ? (
        <button
          type="button"
          aria-label="Próximos itens"
          disabled={!canDown}
          onClick={() => setStart((s) => Math.min(maxStart, s + 1))}
          className={cn(
            "mx-auto grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors desktop:hidden",
            canDown
              ? "hover:bg-white/10 hover:text-foreground"
              : "pointer-events-none opacity-25",
          )}
        >
          <ArrowDown className="size-4" />
        </button>
      ) : null}
    </Card>
  );
}

function TodoRow({ item }: { item: StudentTodoItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="group block rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3.5 transition-colors hover:bg-white/[0.06]"
      >
        <div className="flex items-center justify-between gap-2">
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
