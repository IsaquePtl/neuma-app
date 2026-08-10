import Link from "next/link";
import { Users, Inbox, ArrowRight, Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MentorAgendaAgent } from "@/components/mentor-agenda-agent";
import { formatWaiting } from "@/lib/labels";

export default async function StudioDashboard() {
  const supabase = await createClient();

  const [
    { count: studentCount },
    { count: pendingTotal },
    { data: pending },
    { count: onboardingLeads },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student"),
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("check_ins")
      .select(
        "id, created_at, student:profiles!check_ins_student_id_fkey(full_name, email), node:nodes(title)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10),
    supabase
      .from("tally_submissions")
      .select("id", { count: "exact", head: true })
      .eq("submission_kind", "onboarding")
      .eq("status", "pending"),
  ]);

  const pendingList = pending ?? [];
  const pendingCount = pendingTotal ?? pendingList.length;
  const onboardingCount = onboardingLeads ?? 0;

  const stats = [
    {
      label: "Alunos",
      value: studentCount ?? 0,
      icon: Users,
      href: "/studio/students",
    },
    {
      label: "Por rever",
      value: pendingCount,
      icon: Inbox,
      href: "/studio/journeys/checkins",
    },
    {
      label: "Onboardings",
      value: onboardingCount,
      icon: Sparkles,
      href: "/studio/journeys/onboardings",
    },
  ];

  return (
    <div className="space-y-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Menu e Dashboard
      </p>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href} className="min-w-0">
              <Card className="flex h-full flex-col gap-2 p-3 transition-colors hover:bg-card/80 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4">
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-muted-foreground sm:text-sm">
                    {s.label}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
                    {s.value}
                  </p>
                </div>
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--neuma-coral)]/25 to-[var(--neuma-blue)]/25 text-foreground sm:size-10 sm:rounded-2xl">
                  <Icon className="size-4 sm:size-5" />
                </span>
              </Card>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Por avaliar</h2>
          {pendingCount > 0 ? (
            <Button
              render={<Link href="/studio/journeys/checkins" />}
              nativeButton={false}
              variant="ghost"
              size="sm"
              className="gap-1"
            >
              Ver tudo <ArrowRight className="size-4" />
            </Button>
          ) : null}
        </div>

        {pendingCount === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Tudo em dia. Sem check-ins à tua espera.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_7rem_6.5rem] gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground desktop:grid">
              <span>Aluno</span>
              <span>Bloco</span>
              <span>Espera</span>
              <span className="text-right">Ação</span>
            </div>
            <div className="divide-y divide-white/5">
              {pendingList.map((c) => {
                const student = Array.isArray(c.student)
                  ? c.student[0]
                  : c.student;
                const node = Array.isArray(c.node) ? c.node[0] : c.node;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 desktop:grid desktop:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_7rem_6.5rem]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {student?.full_name ?? student?.email ?? "Aluno"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground desktop:hidden">
                        {node?.title ?? "Bloco"} · há{" "}
                        {formatWaiting(c.created_at)}
                      </p>
                    </div>
                    <p className="hidden truncate text-sm text-muted-foreground desktop:block">
                      {node?.title ?? "Bloco"}
                    </p>
                    <p className="hidden text-sm tabular-nums text-muted-foreground desktop:block">
                      {formatWaiting(c.created_at)}
                    </p>
                    <div className="flex shrink-0 justify-end">
                      <Button
                        render={
                          <Link
                            href={`/studio/checkins/${c.id}?from=dashboard`}
                          />
                        }
                        nativeButton={false}
                        size="sm"
                      >
                        Avaliar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>

      <section className="border-t border-white/10 pt-8">
        <MentorAgendaAgent />
      </section>
    </div>
  );
}
