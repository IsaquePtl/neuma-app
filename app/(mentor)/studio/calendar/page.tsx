import Link from "next/link";
import {
  ExternalLink,
  CalendarDays,
  ClipboardList,
  Sparkles,
  Route,
  Video,
  CalendarPlus,
} from "lucide-react";

import { MentorCalendar } from "@/components/mentor-calendar";
import { CreateCalendarEventPanel } from "@/components/create-calendar-event-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  loadCalendarEvents,
  loadUpcomingSessions,
} from "@/lib/calendar/events";

export default async function MentorCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = sp.y ? Number(sp.y) : now.getFullYear();
  const monthIndex = sp.m ? Number(sp.m) - 1 : now.getMonth();
  const safeYear = Number.isFinite(year) ? year : now.getFullYear();
  const safeMonth =
    Number.isFinite(monthIndex) && monthIndex >= 0 && monthIndex <= 11
      ? monthIndex
      : now.getMonth();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [events, upcoming, { data: mentorProfile }] = await Promise.all([
    loadCalendarEvents(safeYear, safeMonth),
    loadUpcomingSessions(7),
    supabase
      .from("profiles")
      .select("cal_username")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);

  const calUser =
    mentorProfile?.cal_username ||
    process.env.NEXT_PUBLIC_CALCOM_USERNAME ||
    "isaque-portilho-nutfa9";

  const quickActions = [
    {
      href: "/studio/journeys/checkins",
      icon: ClipboardList,
      title: "Check-ins",
      subtitle: "Percursos → Check-ins",
    },
    {
      href: "/studio/journeys/onboardings",
      icon: Sparkles,
      title: "Onboardings",
      subtitle: "Percursos → Onboardings",
    },
    {
      href: "/studio/journeys",
      icon: Route,
      title: "Percursos",
      subtitle: "Lista de jornadas",
    },
    {
      href: `https://cal.com/${calUser}`,
      icon: Video,
      title: "Agendar meet",
      subtitle: "Tipos de reunião no Cal.com",
      external: true,
    },
    {
      href: "#novo-evento",
      icon: CalendarPlus,
      title: "Adicionar evento",
      subtitle: "Criar na app",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Calendário
          </h1>
        </div>
        <Button
          render={
            <a
              href="https://app.cal.com/bookings/upcoming"
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          nativeButton={false}
          variant="secondary"
          size="sm"
          className="gap-1.5"
        >
          Cal.com <ExternalLink className="size-3.5" />
        </Button>
      </header>

      <MentorCalendar
        initialYear={safeYear}
        initialMonth={safeMonth}
        events={events}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ações rápidas</h2>
        <div className="grid gap-2 sm:grid-cols-2 desktop:grid-cols-5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const card = (
              <Card className="flex h-full items-start gap-3 p-3.5 transition-colors hover:bg-card/80 sm:p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--neuma-coral)]/25 to-[var(--neuma-blue)]/25">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{action.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {action.subtitle}
                  </p>
                </div>
                {"external" in action && action.external ? (
                  <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                ) : null}
              </Card>
            );

            if ("external" in action && action.external) {
              return (
                <a
                  key={action.href}
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0"
                >
                  {card}
                </a>
              );
            }

            return (
              <Link key={action.href} href={action.href} className="min-w-0">
                {card}
              </Link>
            );
          })}
        </div>
      </section>

      <CreateCalendarEventPanel />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarDays className="size-5" /> Próximas sessões
        </h2>
        {upcoming.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Sem marcações futuras ingeridas. Quando o webhook do Cal.com
            receber bookings, aparecem aqui.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-white/5">
              {upcoming.map((b) => {
                const when = new Date(b.start_time).toLocaleString("pt-PT", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });
                const who =
                  b.attendee_name ?? b.attendee_email ?? "Convidado";
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{who}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {b.title ?? "Sessão"} · {when}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {b.meet_url ? (
                        <Button
                          render={
                            <a
                              href={b.meet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                          nativeButton={false}
                          size="sm"
                          variant="ghost"
                        >
                          Meet
                        </Button>
                      ) : null}
                      {b.student_id ? (
                        <Button
                          render={
                            <Link href={`/studio/students/${b.student_id}`} />
                          }
                          nativeButton={false}
                          size="sm"
                          variant="ghost"
                        >
                          Ficha
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
