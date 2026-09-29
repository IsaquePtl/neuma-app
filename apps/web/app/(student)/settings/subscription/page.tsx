import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  PaymentHistoryCard,
  SubscriptionSettingsCard,
} from "@/components/subscription-settings-card";
import { getMySubscription, isBillingEnabled } from "@/lib/billing/access";

export default async function StudentSubscriptionSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ cartao?: string }>;
}) {
  if (!isBillingEnabled()) {
    redirect("/settings");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  const [subscription, paymentsResult] = await Promise.all([
    getMySubscription(),
    supabase
      .from("payments")
      .select(
        "id, amount_cents, currency, paid_at, status, hosted_invoice_url, plan",
      )
      .eq("profile_id", user.id)
      .order("paid_at", { ascending: false })
      .limit(12),
  ]);

  return (
    <div className="mx-auto w-full max-w-lg space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Subscrição
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Plano, pagamentos e cartão.
        </p>
      </div>

      {params.cartao === "1" ? (
        <p
          className="rounded-xl border border-[var(--neuma-lime)]/30 bg-[var(--neuma-lime)]/10 px-4 py-3 text-sm text-[var(--neuma-lime)]"
          role="status"
        >
          Cartão actualizado.
        </p>
      ) : null}

      <SubscriptionSettingsCard subscription={subscription} hideTitle />
      <PaymentHistoryCard payments={paymentsResult.data ?? []} />
    </div>
  );
}
