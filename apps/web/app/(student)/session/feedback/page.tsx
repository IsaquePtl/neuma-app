import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  feedbackHrefForItem,
  loadStudentFeedbackList,
} from "@/lib/feedbacks/student";
import { firstNameFromFullName } from "@/lib/profile/greeting";
import { loadMentorCalUsername, loadMyPathWithNodes } from "@/lib/students/queries";
import { formatDateTime, nodeKindLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { NodeKind } from "@/lib/types/database.types";

function feedbackKindLabel(kind: "level" | "check_in") {
  return kind === "level" ? "O feedback" : "Feedback do check-in";
}

export default async function SessionFeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ path, nodes }, mentor] = await Promise.all([
    loadMyPathWithNodes(user!.id),
    loadMentorCalUsername(),
  ]);

  const mentorName = firstNameFromFullName(mentor?.full_name);

  if (!path) {
    return (
      <div className="w-full space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Feedback
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Feedbacks</h1>
        </header>
        <div className="student-path-step student-path-step--done !p-5 text-sm text-muted-foreground">
          Sem feedbacks de momento.
        </div>
      </div>
    );
  }

  const { items, unviewedCount } = await loadStudentFeedbackList(
    supabase,
    user!.id,
    nodes,
  );
  const unviewedItems = items.filter((item) => !item.viewed);

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Feedback
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Feedbacks</h1>
        {unviewedItems.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {unviewedCount === 1
              ? "Tens 1 feedback por ver."
              : `Tens ${unviewedCount} feedbacks por ver.`}
          </p>
        ) : null}
      </header>

      {unviewedItems.length === 0 ? (
        <div className="student-path-step student-path-step--done !p-5 text-sm text-muted-foreground">
          Sem feedbacks de momento.
        </div>
      ) : (
        <div className="space-y-3">
          {unviewedItems.map((item) => {
            const kind = item.nodeKind as NodeKind | null | undefined;
            const metaParts = [
              feedbackKindLabel(item.kind),
              kind ? nodeKindLabel[kind] : null,
              item.weekNumber ? `Semana ${item.weekNumber}` : null,
            ].filter(Boolean);

            return (
              <Link
                key={`${item.kind}:${item.referenceId}`}
                href={feedbackHrefForItem(item)}
                prefetch
                className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/50"
              >
                <div
                  className={cn(
                    "student-path-step student-path-step--active neuma-accent-top !p-4 sm:!p-5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <span
                        className={cn(
                          "inline-flex flex-wrap items-center gap-x-1.5 text-xs font-medium uppercase tracking-[0.14em]",
                          "text-[var(--neuma-coral)]",
                        )}
                      >
                        <span className="mr-0.5 inline-block size-1.5 rounded-full bg-[var(--neuma-coral)]" />
                        {metaParts.join(" · ")}
                      </span>

                      <p className="font-heading text-lg font-bold tracking-tight sm:text-xl">
                        {item.nodeTitle}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                        {mentorName ? ` · ${mentorName}` : null}
                      </p>

                      <p
                        className={cn(
                          "inline-flex items-center gap-1.5 text-sm font-medium",
                          "text-[var(--neuma-coral)]",
                        )}
                      >
                        <MessageSquareText className="size-3.5 shrink-0" />
                        Novo
                      </p>
                    </div>

                    <ArrowRight
                      className={cn(
                        "mt-1 size-5 shrink-0 text-[var(--neuma-coral)] transition-transform group-hover:translate-x-0.5",
                      )}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
