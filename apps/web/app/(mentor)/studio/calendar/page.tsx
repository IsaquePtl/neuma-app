import { Suspense } from "react";
import { ActionNeededList } from "@/components/action-needed-list";
import { CalendarToolbar } from "@/components/calendar-toolbar";
import { MentorCalendar } from "@/components/mentor-calendar";
import { CreateCalendarEventPanel } from "@/components/create-calendar-event-form";
import { UpcomingSessionsSection } from "@/components/mentor-dashboard/upcoming-sessions-section";
import { Button } from "@/components/ui/button";
import { ScreenLoader } from "@/components/screen-loader";
import { createClient } from "@/lib/supabase/server";
import {
  loadCalendarEvents,
  loadUpcomingSessions,
} from "@/lib/calendar/events";
import { loadActionNeeded } from "@/lib/mentor/action-needed";
import type { CalendarEventKind } from "@/lib/calendar/events";

const KIND_LABEL: Record<CalendarEventKind, string> = {
  session: "Sessão",
  due: "Prazo",
  path_start: "Início",
  path_end: "Fim",
  reminder: "Lembrete",
  meeting: "Reunião",
  event: "Evento",
  misc: "Diversos",
};

export default async function MentorCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    y?: string;
    m?: string;
    view?: string;
    kind?: string;
    student?: string;
    oto?: string;
  }>;
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

  const [events, upcoming, actionNeeded, { data: mentorProfile }, { data: students }, { data: paths }] =
    await Promise.all([
      loadCalendarEvents(safeYear, safeMonth, {
        studentReturnTo: "/studio/calendar",
      }),
      loadUpcomingSessions(7),
      loadActionNeeded(),
      supabase
        .from("profiles")
        .select("cal_username")
        .eq("id", user!.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, full_name, email, is_one_to_one")
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
  const oneToOneIds = new Set(
    (students ?? []).filter((s) => s.is_one_to_one).map((s) => s.id),
  );
  const view = sp.view === "week" ? "week" : "month";
  const kindFilter =
    sp.kind && sp.kind in KIND_LABEL ? (sp.kind as CalendarEventKind) : "";
  const filteredEvents = events.filter((event) => {
    if (kindFilter && event.kind !== kindFilter) return false;
    if (sp.student && event.studentId !== sp.student) return false;
    if (sp.oto === "1" && (!event.studentId || !oneToOneIds.has(event.studentId))) {
      return false;
    }
    return true;
  });

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
            Cal.com
          </Button>
        ) : null}
      </header>

      <ActionNeededList items={actionNeeded} />

      <Suspense fallback={<div className="h-14 rounded-2xl border border-white/10 bg-white/[0.03]" />}>
        <CalendarToolbar
          view={view}
          kind={kindFilter}
          studentId={sp.student ?? ""}
          oneToOneOnly={sp.oto === "1"}
          students={studentOptions}
        />
      </Suspense>

      <Suspense fallback={<ScreenLoader className="min-h-[16rem]" />}>
        <MentorCalendar
          initialYear={safeYear}
          initialMonth={safeMonth}
          events={filteredEvents}
          students={studentOptions}
          view={view}
        />
      </Suspense>

      <CreateCalendarEventPanel
        students={studentOptions}
        paths={paths ?? []}
      />

      <UpcomingSessionsSection
        sessions={upcoming}
        returnTo="/studio/calendar"
      />
    </div>
  );
}
