import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { checkInLevelTitle, formatDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default async function StudentCheckinsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: checkIns } = await supabase
    .from("check_ins")
    .select(
      "id, status, kind, video_url, notes, created_at, node_id, level_label, node:nodes(title), feedback:feedbacks(notes, next_steps, video_url, approved, created_at)",
    )
    .eq("student_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div
      className={cn(
        "neuma-mobile-viewport flex w-full flex-col gap-6 overflow-y-auto pb-6",
        "desktop:h-auto desktop:min-h-0 desktop:overflow-visible desktop:pb-4",
      )}
    >
      <header className="shrink-0 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Histórico
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Check-ins
        </h1>
      </header>

      {!checkIns || checkIns.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Ainda não fizeste check-ins.
        </p>
      ) : (
        <div className="space-y-8">
          {checkIns.map((c) => {
            const node = Array.isArray(c.node) ? c.node[0] : c.node;
            const feedback = Array.isArray(c.feedback)
              ? c.feedback[0]
              : c.feedback;
            const title = checkInLevelTitle(node?.title, c.level_label);
            const checkInText =
              c.notes?.trim() ||
              (c.video_url ? "Check-in com ficheiro" : "Check-in enviado");

            return (
              <article key={c.id} className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Check-in
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      {formatDateTime(c.created_at)}
                    </p>
                  </div>
                  <Link
                    href={`/checkins/${c.id}`}
                    className="block space-y-1 transition-colors hover:text-foreground"
                  >
                    <p className="font-medium tracking-tight">{title}</p>
                    <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {checkInText}
                    </p>
                  </Link>
                  {c.status === "needs_revision" && c.node_id ? (
                    <Button
                      render={<Link href={`/checkins/new?node=${c.node_id}`} />}
                      nativeButton={false}
                      variant="secondary"
                      size="sm"
                      className="mt-1 gap-2"
                    >
                      <RefreshCw className="size-3.5" /> Reenviar
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-2 border-t border-white/8 pt-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Feedback
                  </p>
                  {feedback?.notes ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {feedback.notes}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground/70">
                      A aguardar feedback
                    </p>
                  )}
                  {feedback?.next_steps ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {feedback.next_steps}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
