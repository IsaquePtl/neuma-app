import { createClient } from "@/lib/supabase/server";
import { OnboardingNeumaEmbed } from "@/components/onboarding-neuma-embed";
import { SplashScreen } from "@/components/splash-screen";

/**
 * Public route (optional session). student_id for the Tally embed comes only
 * from the authenticated Supabase user — never from URL query params.
 * Logged-in: form renders immediately; submission status is checked client-side.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      {!user ? <SplashScreen /> : null}
      <div className={user ? "auth-flow-instant h-full min-h-0" : "h-full min-h-0"}>
        <OnboardingNeumaEmbed
          studentId={user?.id ?? null}
          backHref={user ? "/home" : "/login/signup"}
          backLabel={user ? "Ir para a app" : "Criar conta"}
        />
      </div>
    </>
  );
}
