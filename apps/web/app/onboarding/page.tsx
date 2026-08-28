import { createClient } from "@/lib/supabase/server";
import { OnboardingNeumaEmbed } from "@/components/onboarding-neuma-embed";
import { SplashScreen } from "@/components/splash-screen";
import { studentHasOnboardingSubmission } from "@/lib/onboarding/submission";

/**
 * Public route (optional session). student_id for the Tally embed comes only
 * from the authenticated Supabase user — never from URL query params.
 * Logged-in: claim any orphan onboarding by email so reload shows thank-you.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let alreadySubmitted = false;
  if (user) {
    alreadySubmitted = await studentHasOnboardingSubmission({
      studentId: user.id,
      email: user.email,
    });
  }

  return (
    <>
      {!user ? <SplashScreen /> : null}
      <div className={user ? "auth-flow-instant h-full min-h-0" : "h-full min-h-0"}>
        <OnboardingNeumaEmbed
          studentId={user?.id ?? null}
          alreadySubmitted={alreadySubmitted}
          backHref={user ? "/home" : "/login/signup"}
          backLabel={user ? "Ir para a app" : "Criar conta"}
        />
      </div>
    </>
  );
}
