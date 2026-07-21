import { Video, ExternalLink, MessageSquare } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { CheckInStatusBadge } from "@/components/status-badges";
import { checkInKindLabel, formatDateTime } from "@/lib/labels";

export default async function StudentCheckinsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: checkIns } = await supabase
    .from("check_ins")
    .select(
      "id, status, kind, video_url, notes, created_at, node:nodes(title), feedback:feedbacks(notes, next_steps, video_url, approved, created_at)",
    )
    .eq("student_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Check-ins</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Os meus check-ins
        </h1>
        <p className="text-muted-foreground">
          O historico das tuas submissoes e o feedback do mentor.
        </p>
      </header>

      {!checkIns || checkIns.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Ainda nao fizeste check-ins. Vai ao teu percurso para comecar.
        </Card>
      ) : (
        <div className="space-y-4">
          {checkIns.map((c) => {
            const node = Array.isArray(c.node) ? c.node[0] : c.node;
            const feedback = Array.isArray(c.feedback)
              ? c.feedback[0]
              : c.feedback;
            return (
              <Card key={c.id} className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{node?.title ?? "Bloco"}</p>
                    <p className="text-xs text-muted-foreground">
                      {checkInKindLabel[c.kind]} - {formatDateTime(c.created_at)}
                    </p>
                  </div>
                  <CheckInStatusBadge status={c.status} />
                </div>

                {c.video_url ? (
                  <a
                    href={c.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Video className="size-4" /> O meu video
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}

                {c.notes ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {c.notes}
                  </p>
                ) : null}

                {feedback ? (
                  <div className="space-y-3 rounded-lg border bg-secondary/40 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="size-4 text-[var(--neuma-coral)]" />
                      Feedback do mentor
                    </p>
                    {feedback.video_url ? (
                      <a
                        href={feedback.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm hover:underline"
                      >
                        <Video className="size-4" /> Ver resposta em video
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
                    {feedback.notes ? (
                      <p className="whitespace-pre-wrap text-sm">
                        {feedback.notes}
                      </p>
                    ) : null}
                    {feedback.next_steps ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Proximos passos
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">
                          {feedback.next_steps}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    A aguardar feedback do mentor.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
