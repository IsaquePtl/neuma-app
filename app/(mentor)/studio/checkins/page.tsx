import Link from "next/link";
import { Inbox } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { CheckInStatusBadge } from "@/components/status-badges";
import { checkInKindLabel, formatDateTime } from "@/lib/labels";

export default async function CheckinsInbox() {
  const supabase = await createClient();

  const { data: checkIns } = await supabase
    .from("check_ins")
    .select(
      "id, status, kind, notes, created_at, student:profiles!check_ins_student_id_fkey(full_name, email), node:nodes(title)",
    )
    .order("created_at", { ascending: false });

  const pending = checkIns?.filter((c) => c.status === "pending") ?? [];
  const done = checkIns?.filter((c) => c.status !== "pending") ?? [];

  function row(c: NonNullable<typeof checkIns>[number]) {
    const student = Array.isArray(c.student) ? c.student[0] : c.student;
    const node = Array.isArray(c.node) ? c.node[0] : c.node;
    return (
      <Link key={c.id} href={`/studio/checkins/${c.id}`}>
        <Card className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-card/80">
          <div className="min-w-0">
            <p className="font-medium">
              {student?.full_name ?? student?.email ?? "Aluno"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {node?.title ?? "Bloco"} - {checkInKindLabel[c.kind]}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(c.created_at)}
            </p>
          </div>
          <CheckInStatusBadge status={c.status} />
        </Card>
      </Link>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Check-ins</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Caixa de entrada
        </h1>
        <p className="text-muted-foreground">
          Revê as submissoes dos alunos e responde com feedback.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Inbox className="size-5" /> Por rever
          <span className="text-muted-foreground">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Tudo em dia. Sem check-ins por rever.
          </Card>
        ) : (
          <div className="grid gap-3">{pending.map(row)}</div>
        )}
      </section>

      {done.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Historico</h2>
          <div className="grid gap-3">{done.map(row)}</div>
        </section>
      ) : null}
    </div>
  );
}
