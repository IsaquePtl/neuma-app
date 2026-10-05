import { redirect } from "next/navigation";

import { PlanCheckoutClient } from "@/components/plan-checkout-client";
import { OneToOneCheckoutClient } from "@/components/one-to-one-checkout-client";
import { getSessionUser } from "@/lib/auth/session";
import { isFixedPlan, type FixedPlan } from "@/lib/stripe/plans";
import { INVITE_TOKEN_PATTERN } from "@/lib/one-to-one/invite-path";

export default async function SubscribeCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    plan?: string;
    from?: string;
    token?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const token = params.token?.trim() ?? "";
  const isInvite = INVITE_TOKEN_PATTERN.test(token);
  const plan = params.plan ?? "";

  const from =
    params.from?.startsWith("/") && !params.from.startsWith("//")
      ? params.from
      : "/subscrever";

  if (!isInvite && !isFixedPlan(plan)) {
    redirect(from);
  }

  return (
    <div className="w-full">
      {isInvite ? (
        <OneToOneCheckoutClient token={token} />
      ) : (
        <PlanCheckoutClient plan={plan as FixedPlan} backHref={from} />
      )}
    </div>
  );
}
