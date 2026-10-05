import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Target, Route } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { loadMyPathWithNodes } from "@/lib/students/queries";
import { loadStudentUnviewedFeedback } from "@/lib/feedbacks/student";
import { loadActivePhaseReview } from "@/lib/nodes/phase-review";
import { studentHasOnboardingSubmission } from "@/lib/onboarding/submission";
import { ClearOnboardingQuery } from "@/components/clear-onboarding-query";
import { PathAwaitingCard } from "@/components/path-awaiting-card";
import { PathOnboardingCard } from "@/components/path-onboarding-card";
import { PathPausedCard } from "@/components/path-paused-card";
import { StudentPathMap } from "@/components/student-path-map";
import { CategoryThemeIcon } from "@/components/category-theme-icon";
import { MusicStaffIcon } from "@/components/music-staff-icon";
import { Button } from "@/components/ui/button";

/**
 * Mobile/tablet: preenche até ao fundo do ecrã (menubar flutuante sobrepõe).
 * Desktop: fluxo no topo.
 */
const PATH_VIEWPORT =
  "neuma-mobile-viewport neuma-mobile-scroll-fade relative flex flex-col [justify-content:safe_center] gap-8 overflow-y-auto " +
  "pb-0 " +
  "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4";

export default async function StudentPathPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { path, nodes } = await loadMyPathWithNodes(user!.id);
  const unviewedFeedback = path
    ? await loadStudentUnviewedFeedback(supabase, user!.id, nodes)
    : { count: 0, items: [], unviewedByNodeId: new Map<string, number>() };
  const activeReview = path
    ? await loadActivePhaseReview(supabase, user!.id, nodes)
    : null;
  const completed = nodes.filter((n) => n.status === "completed").length;
  const total = nodes.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (!path) {
    const hasOnboarding = await studentHasOnboardingSubmission({
      studentId: user!.id,
      email: user?.email,
    });

    if (!hasOnboarding) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .maybeSingle();

      return (
        <Suspense fallback={null}>
          <PathOnboardingCard
            studentId={user!.id}
            initialName={profile?.full_name?.trim() ?? ""}
            initialEmail={user?.email ?? ""}
          />
        </Suspense>
      );
    }

    return (
      <div className="neuma-mobile-viewport flex flex-col items-center justify-center overflow-hidden overscroll-none pb-5 desktop:min-h-0 desktop:flex-1 desktop:justify-center desktop:overflow-visible desktop:pb-4">
        <Suspense fallback={null}>
          <ClearOnboardingQuery href="/path" />
        </Suspense>
        <div className="flex w-full flex-col gap-4 sm:gap-5">
          <PathAwaitingCard />
          <Button
            render={<Link href="/tools" />}
            nativeButton={false}
            size="lg"
            variant="ghost"
            className="h-14 w-full justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-5 text-base font-semibold text-white hover:bg-white/[0.1] hover:text-white"
          >
            <span className="inline-flex items-center gap-2.5">
              <MusicStaffIcon className="size-5" />
              Explorar recursos
            </span>
            <ArrowRight className="size-4 opacity-80" />
          </Button>
        </div>
      </div>
    );
  }

  if (path.status === "paused") {
    return (
      <div className="neuma-mobile-viewport flex flex-col items-center justify-center overflow-hidden overscroll-none pb-5 desktop:min-h-0 desktop:flex-1 desktop:justify-center desktop:overflow-visible desktop:pb-4">
        <PathPausedCard />
      </div>
    );
  }

  return (
    <div className={PATH_VIEWPORT}>
      {/* Cabeçalho leve — o foco é o mapa de níveis */}
      <div className="shrink-0 space-y-3">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <Route className="size-3.5" /> Percurso
        </p>
        <div className="-ml-1 flex items-center gap-1.5">
          <CategoryThemeIcon theme={null} name={path.title} size={40} />
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {path.title}
          </h1>
        </div>
        {path.goal ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Target className="mt-0.5 size-4 shrink-0" />
            {path.goal}
          </p>
        ) : null}
        <div className="flex w-full items-center gap-3 pt-1">
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-[var(--neuma-coral)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
      </div>

      {nodes.length === 0 ? (
        <p className="shrink-0 text-sm text-muted-foreground">
          Ainda sem níveis neste percurso.
        </p>
      ) : (
        <div className="w-full shrink-0">
          <StudentPathMap
            nodes={nodes}
            unviewedByNodeId={unviewedFeedback.unviewedByNodeId}
            review={
              activeReview
                ? {
                    checkpointId: activeReview.checkpointId,
                    pendingIds: activeReview.items
                      .filter((i) => !i.visited)
                      .map((i) => i.id),
                    done: activeReview.items.length - activeReview.pendingCount,
                    total: activeReview.items.length,
                  }
                : null
            }
          />
        </div>
      )}
      {/* Menubar flutuante (~5rem) + folga curta */}
      <div
        aria-hidden
        className="h-[calc(5.5rem+env(safe-area-inset-bottom,0px))] shrink-0 desktop:hidden"
      />
    </div>
  );
}
