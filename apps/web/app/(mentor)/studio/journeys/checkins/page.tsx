import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckInStatusBadge } from "@/components/status-badges";
import { checkInKindLabel, formatDateTime, formatWaiting } from "@/lib/labels";

export default async function JourneysCheckinsPage() {
  const supabase = await createClient();

  const { data: checkIns } = await supabase
    .from("check_ins")
    .select(
      "id, status, kind, notes, created_at, student:profiles!check_ins_student_id_fkey(full_name, email), node:nodes(title)",
    )
    .order("created_at", { ascending: false })
    .limit(60);

  const pendingCheckIns =
    checkIns?.filter((c) => c.status === "pending") ?? [];
  const doneCheckIns =
    checkIns?.filter((c) => c.status !== "pending") ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Por rever{" "}
          <span className="text-muted-foreground">
            ({pendingCheckIns.length})
          </span>
        </h2>
        {pendingCheckIns.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Tudo em dia. Sem check-ins por rever.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_8rem_6.5rem] gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground desktop:grid">
              <span>Aluno</span>
              <span>Bloco</span>
              <span>Espera</span>
              <span className="text-right">Ação</span>
            </div>
            <div className="divide-y divide-white/5">
              {pendingCheckIns.map((c) => {
                const student = Array.isArray(c.student)
                  ? c.student[0]
                  : c.student;
                const node = Array.isArray(c.node) ? c.node[0] : c.node;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 desktop:grid desktop:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_8rem_6.5rem]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {student?.full_name ?? student?.email ?? "Aluno"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground desktop:hidden">
                        {node?.title ?? "Bloco"} · {checkInKindLabel[c.kind]} ·
                        há {formatWaiting(c.created_at)}
                      </p>
                    </div>
                    <p className="hidden truncate text-sm text-muted-foreground desktop:block">
                      {node?.title ?? "Bloco"} · {checkInKindLabel[c.kind]}
                    </p>
                    <p className="hidden text-sm tabular-nums text-muted-foreground desktop:block">
                      {formatWaiting(c.created_at)}
                    </p>
                    <div className="flex shrink-0 justify-end">
                      <Button
                        render={<Link href={`/studio/checkins/${c.id}`} />}
                        nativeButton={false}
                        size="sm"
                      >
                        Avaliar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>

      {doneCheckIns.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Histórico ({doneCheckIns.length})
          </h2>
          <div className="grid gap-2">
            {doneCheckIns.slice(0, 20).map((c) => {
              const student = Array.isArray(c.student)
                ? c.student[0]
                : c.student;
              const node = Array.isArray(c.node) ? c.node[0] : c.node;
              return (
                <Link key={c.id} href={`/studio/checkins/${c.id}`}>
                  <Card className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-card/80">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {student?.full_name ?? student?.email ?? "Aluno"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {node?.title ?? "Bloco"} ·{" "}
                        {formatDateTime(c.created_at)}
                      </p>
                    </div>
                    <CheckInStatusBadge status={c.status} />
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
