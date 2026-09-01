"use client";

import { startTransition, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import {
  markNodeFeedbackViewedAction,
  markStudentFeedbackViewedAction,
} from "@/lib/actions/student-feedback-views";
import type { StudentFeedbackViewRef } from "@/lib/feedbacks/student-shared";
import { requestStudentBadgesRefresh } from "@/lib/student-badges-client";
import { Button } from "@/components/ui/button";

async function markFeedbackViewedInBackground(
  nodeId: string | undefined,
  feedbackRefs: StudentFeedbackViewRef[],
) {
  try {
    if (feedbackRefs.length > 0) {
      await markStudentFeedbackViewedAction(feedbackRefs);
    } else if (nodeId) {
      await markNodeFeedbackViewedAction(nodeId);
    }
    requestStudentBadgesRefresh();
  } catch {
    // Navigation should not wait on badge bookkeeping.
  }
}

export function FeedbackContinueAction({
  href,
  nodeId,
  feedbackRefs = [],
  label = "Continuar",
}: {
  href: string;
  nodeId?: string;
  feedbackRefs?: StudentFeedbackViewRef[];
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, setIsPending] = useState(false);

  const handleClick = () => {
    if (isPending) return;

    setIsPending(true);
    void markFeedbackViewedInBackground(nodeId, feedbackRefs);
    startTransition(() => {
      // Same node deep links keep query params on push; replace clears them.
      if (pathname === href) {
        router.replace(href);
      } else {
        router.push(href);
      }
    });
  };

  return (
    <div className="min-w-0 space-y-2">
      <Button
        type="button"
        size="lg"
        className="h-12 w-full gap-2 text-base font-semibold"
        disabled={isPending}
        aria-busy={isPending}
        onClick={handleClick}
      >
        {label}
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
