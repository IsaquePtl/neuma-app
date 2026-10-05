import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding-form";
import { SplashScreen } from "@/components/splash-screen";

/** Full auth panel — same stage as Soundworks / old Tally embed (not neuma-mobile-viewport). */
const ONBOARDING_STAGE =
  "soundworks-stage absolute inset-0 z-10 flex touch-manipulation flex-col overflow-hidden overscroll-none";

/**
 * Public route for applicants (1:1). Logged-in self-serve students use the
 * inline form on /home instead of this fullscreen shell.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Self-serve: form embutido no /home (menubar + sidebar).
  if (user) {
    redirect("/home?onboarding=1");
  }

  return (
    <>
      <SplashScreen />
      <div className="relative h-full min-h-0">
        <div className={ONBOARDING_STAGE}>
          <OnboardingForm
            studentId={null}
            initialName=""
            initialEmail=""
            alreadySubmitted={false}
            backHref="/home"
            backLabel="Ir para a app"
          />
        </div>
      </div>
    </>
  );
}
