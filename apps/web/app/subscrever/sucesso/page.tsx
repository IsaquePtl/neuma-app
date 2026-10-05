import { redirect } from "next/navigation";

import { CheckoutSuccessClient } from "@/components/checkout-success-client";
import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";

export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    one_to_one?: string;
    signup_lead?: string;
  }>;
}) {
  const params = await searchParams;
  const signupLead = Boolean(params.signup_lead?.trim());
  const user = await getSessionUser();

  // Lead signup: ainda não há sessão — finalize provisiona e faz sign-in.
  if (!user && !signupLead) redirect("/login");

  const profile = user ? await getCurrentProfile() : null;
  const oneToOne = params.one_to_one === "1";

  return (
    <div className="flex w-full flex-col items-center desktop:items-stretch">
      <CheckoutSuccessClient
        sessionId={params.session_id ?? null}
        oneToOne={oneToOne}
        signupLead={signupLead}
        displayName={profile?.full_name ?? null}
      />
    </div>
  );
}
