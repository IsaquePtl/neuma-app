import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Sparkles,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { loadTodayEvents } from "@/lib/calendar/events";
import { Card } from "@/components/ui/card";

export default async function StudioDashboard() {
  const supabase = await createClient();

  const [
    { count: pendingTotal },
    { count: onboardingLeads },
    { count: studentTotal },
    todayEvents,
  ] = await Promise.all([
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("tally_submissions")
      .select("id", { count: "exact", head: true })
      .eq("submission_kind", "onboarding")
      .in("status", ["pending", "linked"]),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student"),
    loadTodayEvents(),
  ]);

  const pendingCount = pendingTotal ?? 0;
  const onboardingCount = onboardingLeads ?? 0;
  const studentsCount = studentTotal ?? 0;
  const todayCount = todayEvents.length;

  const shortcuts = [
    {
      href: "/studio/journeys/checkins",
      icon: ClipboardList,
      title: "Check-ins por rever",
      count: pendingCount,
    },
    {
      href: "/studio/journeys/onboardings",
      icon: Sparkles,
      title: "Onboardings novos",
      count: onboardingCount,
    },
    {
      href: "/studio/students",
      icon: Users,
      title: "Alunos",
      count: studentsCount,
    },
    {
      href: "/studio/calendar",
      icon: CalendarDays,
      title: "Calendário",
      count: todayCount,
    },
  ] as const;

  const cards = [
    {
      href: "/studio/journeys/checkins",
      icon: ClipboardList,
      title: "Check-ins recentes",
      value: pendingCount,
      subtitle:
        pendingCount === 0
          ? "Nada por rever neste momento"
          : pendingCount === 1
            ? "1 check-in à espera de avaliação"
            : `${pendingCount} check-ins à espera de avaliação`,
      delay: "neuma-enter-delay-2",
    },
    {
      href: "/studio/journeys/onboardings",
      icon: Sparkles,
      title: "Novos onboardings",
      value: onboardingCount,
      subtitle:
        onboardingCount === 0
          ? "Sem novos pedidos por tratar"
          : onboardingCount === 1
            ? "1 onboarding por tratar"
            : `${onboardingCount} onboardings por tratar`,
      delay: "neuma-enter-delay-3",
    },
  ] as const;

  return (
    <div className="space-y-8">
      <p className="neuma-enter-up text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Menu e Dashboard
      </p>

      <section className="neuma-enter-up neuma-enter-delay-1 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card className="flex min-h-[12rem] flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Eventos para hoje</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                {todayCount}
              </p>
            </div>
            <Link
              href="/studio/calendar"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              Abrir
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {todayEvents.length === 0 ? (
            <p className="mt-auto text-sm text-muted-foreground">
              Nenhum evento hoje
            </p>
          ) : (
            <ul className="mt-auto divide-y divide-white/5 border-t border-white/5">
              {todayEvents.slice(0, 4).map((event) => (
                <li key={event.id}>
                  {event.href ? (
                    <Link
                      href={event.href}
                      className="flex items-baseline justify-between gap-3 py-2.5 transition-colors hover:text-foreground"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {event.title}
                        {event.studentName ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {event.studentName}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {event.meta ?? "—"}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-baseline justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate font-medium">
                        {event.title}
                        {event.studentName ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {event.studentName}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {event.meta ?? "—"}
                      </span>
                    </div>
                  )}
                </li>
              ))}
              {todayEvents.length > 4 ? (
                <li className="pt-2.5 text-xs text-muted-foreground">
                  +{todayEvents.length - 4} mais no calendário
                </li>
              ) : null}
            </ul>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {shortcuts.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <Card className="flex h-full min-h-[5.5rem] flex-col justify-between gap-3 p-3.5 transition-colors hover:bg-card/80 sm:min-h-[6.25rem] sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--neuma-coral)]/25 to-[var(--neuma-blue)]/25">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
                      {action.count}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-snug sm:text-[15px]">
                    {action.title}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className={`neuma-enter-up ${card.delay} group min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--neuma-coral)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
            >
              <Card className="flex h-full min-h-[11rem] flex-col justify-between gap-6 p-6 transition-colors hover:bg-card/80 sm:min-h-[13rem] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-muted-foreground sm:text-base">
                      {card.title}
                    </p>
                    <p className="text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                      {card.value}
                    </p>
                  </div>
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--neuma-coral)]/25 to-[var(--neuma-blue)]/25 text-foreground sm:size-14">
                    <Icon className="size-5 sm:size-6" />
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{card.subtitle}</p>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground/80 transition-transform group-hover:translate-x-0.5">
                    Abrir
                    <ArrowRight className="size-4" />
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
