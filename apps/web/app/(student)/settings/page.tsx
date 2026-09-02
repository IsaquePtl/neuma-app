import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "@/components/settings-view";
import { SubscriptionSettingsCard } from "@/components/subscription-settings-card";
import { getAccessState, getMySubscription } from "@/lib/billing/access";
import { isBillingEnabled } from "@/lib/billing/access";

export default async function StudentSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url, bio, instagram, whatsapp")
    .eq("id", user!.id)
    .single();

  const billingOn = isBillingEnabled();
  let subscription = null;
  let payments: {
    id: string;
    amount_cents: number;
    currency: string;
    paid_at: string | null;
    status: string | null;
    hosted_invoice_url: string | null;
    plan: string | null;
  }[] = [];

  if (billingOn) {
    const [sub, paymentsResult] = await Promise.all([
      getMySubscription(),
      supabase
        .from("payments")
        .select(
          "id, amount_cents, currency, paid_at, status, hosted_invoice_url, plan",
        )
        .eq("profile_id", user!.id)
        .order("paid_at", { ascending: false })
        .limit(12),
    ]);
    subscription = sub;
    payments = paymentsResult.data ?? [];
    await getAccessState();
  }

  return (
    <div className="space-y-6">
      {billingOn ? (
        <SubscriptionSettingsCard
          subscription={subscription}
          payments={payments}
        />
      ) : null}
      <SettingsView
        name={profile?.full_name ?? null}
        email={profile?.email ?? user!.email ?? ""}
        role="student"
        avatarUrl={profile?.avatar_url}
        bio={profile?.bio}
        instagram={profile?.instagram}
        whatsapp={profile?.whatsapp}
      />
    </div>
  );
}
