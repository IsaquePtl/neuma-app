import Link from "next/link";

import { PendingCheckinsSection } from "@/components/mentor-dashboard/pending-checkins-section";
import { CheckInStatusBadge } from "@/components/status-badges";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  loadPendingCheckIns,
  mentorCheckInHref,
  mentorCheckInLevelTitle,
  resolveRelation,
  type MentorCheckInNode,
} from "@/lib/mentor/checkins";
import { formatDateTime } from "@/lib/labels";

export default async function JourneysCheckinsPage() {
  const supabase = await createClient();

  const [{ data: checkIns }, pendingCheckIns] = await Promise.all([
    supabase
      .from("check_ins")
      .select(
        "id, status, kind, notes, created_at, node_id, student:profiles!check_ins_student_id_fkey(full_name, email), node:nodes(title, path_id, order_index, kind, week_number)",
      )
      .order("created_at", { ascending: false })
      .limit(60),
    loadPendingCheckIns(60),
  ]);

  const doneCheckIns =
    checkIns?.filter((c) => c.status !== "pending") ?? [];

  return (
    <div className="space-y-6">
      <PendingCheckinsSection checkIns={pendingCheckIns} />

      {doneCheckIns.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Histórico ({doneCheckIns.length})
          </h2>
          <div className="grid gap-2">
            {doneCheckIns.slice(0, 20).map((c) => {
              const student = resolveRelation(c.student);
              const node = resolveRelation(
                c.node as MentorCheckInNode | MentorCheckInNode[] | null | undefined,
              );
              return (
                <Link key={c.id} href={mentorCheckInHref({ ...c, node })}>
                  <Card className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-card/80">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {student?.full_name ?? student?.email ?? "Aluno"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {mentorCheckInLevelTitle(node)} ·{" "}
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
