import Link from "next/link";
import { ExternalLink, CalendarDays } from "lucide-react";

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

  const [events, upcoming, { data: mentorProfile }, { data: students }, { data: paths }] =
    await Promise.all([
      loadCalendarEvents(safeYear, safeMonth),
      loadUpcomingSessions(7),
      supabase
        .from("profiles")
        .select("cal_username")
        .eq("id", user!.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "student")
        .order("full_name"),
      supabase
        .from("paths")
        .select("id, title, student_id")
        .in("status", ["draft", "active", "paused", "completed"])
        .order("title"),
    ]);

  const calUser =
    mentorProfile?.cal_username ||
    process.env.NEXT_PUBLIC_CALCOM_USERNAME ||
    "";

  const studentOptions = (students ?? []).map((s) => ({
    id: s.id,
    label: s.full_name ?? s.email ?? s.id,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Calendário
          </h1>
        </div>
        {calUser ? (
          <Button
            render={
              <a
                href={`https://app.cal.com/bookings/upcoming`}
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
        ) : null}
      </header>

      <MentorCalendar
        initialYear={safeYear}
        initialMonth={safeMonth}
        events={events}
        students={studentOptions}
      />

      <CreateCalendarEventPanel
        students={studentOptions}
        paths={paths ?? []}
      />

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
                const levelLine = b.levelTitle
                  ? `${b.levelTitle}${b.levelTheme ? ` · ${b.levelTheme}` : ""}`
                  : null;
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
                      {levelLine ? (
                        <p className="truncate text-xs text-muted-foreground">
                          Nível: {levelLine}
                        </p>
                      ) : null}
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
