"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import {
  markNodeFeedbackViewedAction,
  markStudentFeedbackViewedAction,
} from "@/lib/actions/student-feedback-views";
import type { StudentFeedbackViewRef } from "@/lib/feedbacks/student-shared";
import { Button } from "@/components/ui/button";

async function markFeedbackViewed(
  nodeId: string | undefined,
  feedbackRefs: StudentFeedbackViewRef[],
) {
  if (feedbackRefs.length > 0) {
    await markStudentFeedbackViewedAction(feedbackRefs);
  } else if (nodeId) {
    await markNodeFeedbackViewedAction(nodeId);
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
  const [isPending, setIsPending] = useState(false);

  const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    try {
      await markFeedbackViewed(nodeId, feedbackRefs);
    } catch {
      setIsPending(false);
      return;
    }

    router.push(href);
    router.refresh();
    setIsPending(false);
  };

  return (
    <div className="min-w-0 space-y-2">
      <Button
        render={
          <Link
            href={href}
            onClick={handleClick}
            aria-busy={isPending}
          />
        }
        nativeButton={false}
        size="lg"
        className="h-12 w-full gap-2 text-base font-semibold"
        disabled={isPending}
      >
        {label}
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
