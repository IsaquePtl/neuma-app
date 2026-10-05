"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { OnboardingForm } from "@/components/onboarding-form";
import { PathAwaitingCard } from "@/components/path-awaiting-card";
import {
  StudentTodoList,
  type StudentTodoItem,
} from "@/components/student-todo-list";
import { cn } from "@/lib/utils";

const HOME_VIEWPORT =
  "neuma-mobile-viewport flex flex-col justify-center gap-5 overflow-hidden overscroll-none pb-5 " +
  "desktop:min-h-0 desktop:flex-1 desktop:justify-center desktop:gap-3 desktop:overflow-visible desktop:pb-4";

const HOME_FORM_VIEWPORT =
  "neuma-mobile-viewport flex w-full min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-contain pb-5 " +
  "desktop:min-h-0 desktop:flex-1 desktop:justify-center desktop:overflow-y-auto desktop:pb-4";

export function HomeAwaitingPanel({
  greeting,
  studentName,
  hasOnboarding,
  todos,
  studentId,
  initialName,
  initialEmail,
}: {
  greeting: string;
  studentName: string;
  hasOnboarding: boolean;
  todos: StudentTodoItem[];
  studentId: string;
  initialName: string;
  initialEmail: string;
  /** @deprecated URL (?onboarding=1) é a fonte de verdade */
  initialOpenOnboarding?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openOnboarding =
    searchParams.get("onboarding") === "1" && !hasOnboarding;

  useEffect(() => {
    if (hasOnboarding && searchParams.get("onboarding") === "1") {
      router.replace("/home", { scroll: false });
    }
  }, [hasOnboarding, searchParams, router]);

  function openForm() {
    router.replace("/home?onboarding=1", { scroll: false });
  }

  if (openOnboarding) {
    return (
      <div className={HOME_FORM_VIEWPORT}>
        <OnboardingForm
          variant="inline"
          studentId={studentId}
          initialName={initialName}
          initialEmail={initialEmail}
          alreadySubmitted={false}
        />
      </div>
    );
  }

  return (
    <div className={HOME_VIEWPORT}>
      <div className="neuma-enter-up shrink-0 space-y-1">
        <h1 className="font-heading text-[1.75rem] leading-tight tracking-tight sm:text-3xl">
          <span className="font-normal">{greeting}, </span>
          <span className="font-bold">{studentName}</span>
        </h1>
      </div>

      <div
        className={cn(
          "neuma-enter-up neuma-enter-delay-1 min-w-0 space-y-4",
        )}
      >
        {hasOnboarding ? <PathAwaitingCard /> : null}
        <StudentTodoList
          items={todos}
          onInlineItem={(item) => {
            if (item.key === "onboarding") openForm();
          }}
        />
      </div>
    </div>
  );
}
