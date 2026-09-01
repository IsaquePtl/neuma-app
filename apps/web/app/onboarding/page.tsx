import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding-form";
import { SplashScreen } from "@/components/splash-screen";
import { studentHasOnboardingSubmission } from "@/lib/onboarding/submission";

/** Full auth panel — same stage as Soundworks / old Tally embed (not neuma-mobile-viewport). */
const ONBOARDING_STAGE =
  "soundworks-stage absolute inset-0 z-10 flex touch-manipulation flex-col overflow-hidden overscroll-none";

/**
 * Public route (optional session). student_id comes only from the authenticated
 * Supabase user — never from URL query params.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialName = "";
  let alreadySubmitted = false;

  if (user) {
    const [{ data: profile }, hasSubmission] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
      studentHasOnboardingSubmission({
        studentId: user.id,
        email: user.email,
      }),
    ]);

    initialName = profile?.full_name?.trim() ?? "";
    alreadySubmitted = hasSubmission;
  }

  return (
    <>
      {!user ? <SplashScreen /> : null}
      <div
        className={
          user
            ? "auth-flow-instant relative h-full min-h-0"
            : "relative h-full min-h-0"
        }
      >
        <div className={ONBOARDING_STAGE}>
          <OnboardingForm
            studentId={user?.id ?? null}
            initialName={initialName}
            initialEmail={user?.email ?? ""}
            alreadySubmitted={alreadySubmitted}
            backHref={user ? "/home" : "/login/signup"}
            backLabel={user ? "Ir para a app" : "Criar conta"}
          />
        </div>
      </div>
    </>
  );
}
