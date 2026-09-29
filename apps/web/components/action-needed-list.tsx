import Link from "next/link";

import type { ActionNeededItem } from "@/lib/mentor/action-needed";

export function ActionNeededList({ items }: { items: ActionNeededItem[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight">Exige acção</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nada atrasado nem check-ins à espera.
        </p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex flex-col gap-0.5 px-4 py-3 hover:bg-white/[0.04]"
              >
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
