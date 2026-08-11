import Link from "next/link";
import {
  ArrowLeft,
  Video,
  ExternalLink,
  MessageSquare,
  RefreshCw,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHero } from "@/components/page-hero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckInStatusBadge } from "@/components/status-badges";
import { checkInKindLabel, checkInLevelTitle, formatDateTime } from "@/lib/labels";

export default async function StudentCheckinsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: checkIns }, { data: activePath }] = await Promise.all([
    supabase
      .from("check_ins")
      .select(
        "id, status, kind, video_url, notes, created_at, node_id, level_label, node:nodes(title), feedback:feedbacks(notes, next_steps, video_url, approved, created_at)",
      )
      .eq("student_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("paths")
      .select("id")
      .eq("student_id", user!.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { data: activeNode } = activePath
    ? await supabase
        .from("nodes")
        .select("id")
        .eq("path_id", activePath.id)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <Link
        href="/session"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> 1:1
      </Link>

      <PageHero
        eyebrow="1:1"
        title="Os teus check-ins"
        subtitle="Histórico das tuas submissões e o feedback do mentor."
      >
        {activeNode ? (
          <Button
            render={<Link href={`/checkins/new?node=${activeNode.id}`} />}
            nativeButton={false}
            size="sm"
          >
            Novo check-in
          </Button>
        ) : (
          <Button
            render={<Link href="/checkins/new" />}
            nativeButton={false}
            size="sm"
          >
            Novo check-in
          </Button>
        )}
      </PageHero>

      {!checkIns || checkIns.length === 0 ? (
        <Card className="space-y-4 p-8 text-center">
          <p className="text-muted-foreground">Ainda não fizeste check-ins.</p>
          <Button
            render={
              <Link
                href={
                  activeNode ? `/checkins/new?node=${activeNode.id}` : "/checkins/new"
                }
              />
            }
            nativeButton={false}
          >
            Fazer check-in
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {checkIns.map((c) => {
            const node = Array.isArray(c.node) ? c.node[0] : c.node;
            const feedback = Array.isArray(c.feedback)
              ? c.feedback[0]
              : c.feedback;
            return (
              <Card key={c.id} className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/checkins/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {checkInLevelTitle(node?.title, c.level_label)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {checkInKindLabel[c.kind]} · {formatDateTime(c.created_at)}
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
                    <Video className="size-4" /> Ficheiro
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}

                {c.notes ? (
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {c.notes}
                  </p>
                ) : null}

                {feedback ? (
                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="size-4 text-[var(--neuma-coral)]" />
                      Feedback do mentor
                    </p>
                    {feedback.notes ? (
                      <p className="line-clamp-3 whitespace-pre-wrap text-sm">
                        {feedback.notes}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    A aguardar feedback.
                  </p>
                )}

                {c.status === "needs_revision" && c.node_id ? (
                  <Button
                    render={
                      <Link href={`/checkins/new?node=${c.node_id}`} />
                    }
                    nativeButton={false}
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="size-4" /> Reenviar
                  </Button>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
