import { redirect } from "next/navigation";

import { CardUpdateCheckoutClient } from "@/components/card-update-checkout-client";
import { getSessionUser } from "@/lib/auth/session";
import { isBillingEnabled } from "@/lib/billing/access";

export default async function CardUpdatePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isBillingEnabled()) redirect("/settings/subscription");

  return (
    <div className="mx-auto w-full max-w-md">
      <CardUpdateCheckoutClient />
    </div>
  );
}
