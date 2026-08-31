import Link from "next/link";
import {
  ArrowRight,
  Dumbbell,
  Flag,
  MessageSquare,
  Phone,
  RefreshCw,
  Video,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { hasVisibleCheckInFeedback } from "@/lib/feedbacks/student";
import { firstNameFromFullName } from "@/lib/profile/greeting";
import { loadMentorCalUsername } from "@/lib/students/queries";
import { Button } from "@/components/ui/button";
import { CheckInStatusBadge } from "@/components/status-badges";
import {
  checkInKindLabel,
  checkInLevelTitle,
  formatDateTime,
  nodeKindLabel,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import type {
  CheckInKind,
  CheckInStatus,
  NodeKind,
} from "@/lib/types/database.types";

function studentCheckInHref(checkIn: {
  id: string;
  node_id: string | null;
  status: CheckInStatus;
}) {
  if (!checkIn.node_id) return `/checkins/${checkIn.id}`;

  const params = new URLSearchParams({ checkIn: checkIn.id });
  if (checkIn.status === "pending" || checkIn.status === "needs_revision") {
    params.set("focus", "checkin");
  }
  return `/path/${checkIn.node_id}?${params.toString()}`;
}

function kindIconEl(kind: NodeKind | CheckInKind | null | undefined) {
  switch (kind) {
    case "call":
      return <Phone className="size-3" />;
    case "lesson":
    case "resource":
    case "video":
      return <Video className="size-3" />;
    case "milestone":
      return <Flag className="size-3" />;
    default:
      return <Dumbbell className="size-3" />;
  }
}

function kindLabel(
  nodeKind: NodeKind | null | undefined,
  checkInKind: CheckInKind,
) {
  if (nodeKind) return nodeKindLabel[nodeKind];
  return checkInKindLabel[checkInKind];
}

/** Scroll natural (como Feedbacks) — lista longa, sem viewport fixo. */
const CHECKINS_VIEWPORT =
  "w-full min-w-0 space-y-6 desktop:mx-auto desktop:max-w-3xl";

export default async function StudentCheckinsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [mentor, { data: checkIns }] = await Promise.all([
    loadMentorCalUsername(),
    supabase
      .from("check_ins")
      .select(
        "id, status, kind, video_url, notes, created_at, node_id, level_label, node:nodes(title, week_number, kind), feedback:feedbacks(notes, next_steps, video_url, approved, created_at)",
      )
      .eq("student_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  const mentorName = firstNameFromFullName(mentor?.full_name) ?? "mentor";

  return (
    <div className={CHECKINS_VIEWPORT}>
      <header className="space-y-1">
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
        <div className="min-w-0 space-y-3">
          {checkIns.map((c) => {
            const node = Array.isArray(c.node) ? c.node[0] : c.node;
            const feedback = Array.isArray(c.feedback)
              ? c.feedback[0]
              : c.feedback;
            const title = checkInLevelTitle(node?.title, c.level_label);
            const hasFeedback = hasVisibleCheckInFeedback(feedback);
            const previewText =
              c.notes?.trim() ||
              (c.video_url ? "Check-in com ficheiro" : "Check-in enviado");
            const nodeKind = node?.kind as NodeKind | undefined;

            return (
              <article key={c.id} className="min-w-0 space-y-2">
                <Link
                  href={studentCheckInHref(c)}
                  prefetch
                  className="group block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50"
                >
                  <div
                    className={cn(
                      "student-path-step student-path-step--done min-w-0 !p-4 sm:!p-5",
                      hasFeedback && "neuma-accent-top",
                    )}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <span className="inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
                          {kindIconEl(nodeKind ?? c.kind)}
                          {kindLabel(nodeKind, c.kind)}
                          {node?.week_number
                            ? ` · Sem. ${node.week_number}`
                            : null}
                        </span>

                        <p className="break-words font-heading text-lg font-bold tracking-tight sm:text-xl">
                          {title}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(c.created_at)}
                        </p>

                        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground/90">
                          {previewText}
                        </p>

                        {hasFeedback ? (
                          <p className="inline-flex max-w-full flex-wrap items-center gap-1.5 text-sm font-medium text-[var(--neuma-coral)]">
                            <MessageSquare className="size-3.5 shrink-0" />
                            Feedback do {mentorName}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground/80">
                            A aguardar feedback
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-row items-center gap-2 self-start">
                        <CheckInStatusBadge status={c.status} />
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>

                {c.status === "needs_revision" && c.node_id ? (
                  <Button
                    render={<Link href={`/checkins/new?node=${c.node_id}`} />}
                    nativeButton={false}
                    variant="secondary"
                    size="sm"
                    className="w-full gap-2 sm:w-auto"
                  >
                    <RefreshCw className="size-3.5" /> Reenviar check-in
                  </Button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
