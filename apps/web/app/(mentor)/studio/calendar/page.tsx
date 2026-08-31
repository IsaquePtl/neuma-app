import { MentorCalendar } from "@/components/mentor-calendar";
import { CreateCalendarEventPanel } from "@/components/create-calendar-event-form";
import { UpcomingSessionsSection } from "@/components/mentor-dashboard/upcoming-sessions-section";
import { Button } from "@/components/ui/button";
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
      loadCalendarEvents(safeYear, safeMonth, {
        studentReturnTo: "/studio/calendar",
      }),
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
            Cal.com
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

      <UpcomingSessionsSection
        sessions={upcoming}
        returnTo="/studio/calendar"
      />
    </div>
  );
}
