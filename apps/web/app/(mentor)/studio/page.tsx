import { OnboardingInboxSection } from "@/components/mentor-dashboard/onboarding-inbox-section";
import { PendingCheckinsSection } from "@/components/mentor-dashboard/pending-checkins-section";
import { UpcomingSessionsSection } from "@/components/mentor-dashboard/upcoming-sessions-section";
import { loadUpcomingSessions } from "@/lib/calendar/events";
import { loadPendingCheckIns } from "@/lib/mentor/checkins";
import { loadOnboardingInbox } from "@/lib/mentor/onboardings";

const DASHBOARD_RETURN_TO = "/studio";

export default async function StudioDashboard() {
  const [upcomingSessions, pendingCheckIns, { inbox, students }] =
    await Promise.all([
      loadUpcomingSessions(7),
      loadPendingCheckIns(60),
      loadOnboardingInbox(),
    ]);

  return (
    <div className="space-y-8">
      <header className="neuma-enter-up space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Dashboard diário
        </p>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Geral</h1>
      </header>

      <div className="neuma-enter-up neuma-enter-delay-1 space-y-8">
        <UpcomingSessionsSection
          sessions={upcomingSessions}
          returnTo={DASHBOARD_RETURN_TO}
          limit={5}
          viewAllHref="/studio/calendar"
        />

        <PendingCheckinsSection checkIns={pendingCheckIns} limit={5} />

        <OnboardingInboxSection
          inbox={inbox}
          students={students}
          limit={5}
        />
      </div>
    </div>
  );
}
