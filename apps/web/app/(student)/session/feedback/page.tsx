import Link from "next/link";
import { ExternalLink, Video } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/labels";

export default async function SessionFeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: activePath } = await supabase
    .from("paths")
    .select("id")
    .eq("student_id", user!.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: activeNode } = activePath
    ? await supabase
        .from("nodes")
        .select("id, title")
        .eq("path_id", activePath.id)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };

  if (!activeNode) {
    return (
      <div className="w-full space-y-6">
        <Card className="p-6 text-sm text-muted-foreground">
          Sem feedbacks de momento.
        </Card>
      </div>
    );
  }

  const [{ data: levelFeedbacks }, { data: checkInFeedbacks }] =
    await Promise.all([
      supabase
        .from("level_feedbacks")
        .select("id, notes, video_url, file_url, created_at")
        .eq("node_id", activeNode.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("check_ins")
        .select(
          "id, created_at, feedback:feedbacks(notes, next_steps, video_url, approved, created_at)",
        )
        .eq("student_id", user!.id)
        .eq("node_id", activeNode.id)
        .order("created_at", { ascending: false }),
    ]);

  const fromCheckIns = (checkInFeedbacks ?? [])
    .map((c) => {
      const fb = Array.isArray(c.feedback) ? c.feedback[0] : c.feedback;
      if (!fb) return null;
      return { checkInId: c.id, feedback: fb };
    })
    .filter(Boolean);

  const empty =
    (levelFeedbacks?.length ?? 0) === 0 && fromCheckIns.length === 0;

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Feedback
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {activeNode.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Feedback do mentor neste nível.
        </p>
      </header>

      {empty ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Sem feedbacks de momento.
        </Card>
      ) : (
        <div className="space-y-3">
          {(levelFeedbacks ?? []).map((f) => (
            <Card key={f.id} className="space-y-2 p-5">
              <p className="text-xs text-muted-foreground">
                Feedback do nível · {formatDateTime(f.created_at)}
              </p>
              {f.notes ? (
                <p className="whitespace-pre-wrap text-sm">{f.notes}</p>
              ) : null}
              {f.video_url ? (
                <a
                  href={f.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[var(--neuma-coral)] hover:underline"
                >
                  <Video className="size-4" /> Ver vídeo
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
              {f.file_url ? (
                <a
                  href={f.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Abrir ficheiro <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </Card>
          ))}

          {fromCheckIns.map((row) => {
            if (!row) return null;
            const fb = row.feedback;
            return (
              <Card key={row.checkInId} className="space-y-2 p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Feedback do check-in · {formatDateTime(fb.created_at)}
                  </p>
                  <Link
                    href={`/checkins/${row.checkInId}`}
                    className="text-xs text-[var(--neuma-coral)] hover:underline"
                  >
                    Ver check-in
                  </Link>
                </div>
                {fb.notes ? (
                  <p className="whitespace-pre-wrap text-sm">{fb.notes}</p>
                ) : null}
                {fb.next_steps ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    Próximos passos: {fb.next_steps}
                  </p>
                ) : null}
                {fb.video_url ? (
                  <a
                    href={fb.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[var(--neuma-coral)] hover:underline"
                  >
                    <Video className="size-4" /> Ver vídeo
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
