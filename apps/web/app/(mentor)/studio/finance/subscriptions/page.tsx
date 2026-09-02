import { SubscriptionsList } from "@/components/subscriptions-list";
import type { SubscriptionListRow } from "@/components/subscriptions-list";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type {
  BillingPlan,
  SubscriptionStatus,
} from "@/lib/types/database.types";

export const dynamic = "force-dynamic";

type ProfileJoin = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  billing_exempt: boolean;
} | null;

export default async function FinanceSubscriptionsPage() {
  const supabase = await createClient();

  const [{ data: subs }, { data: payments }, { data: students }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select(
          `
          id,
          profile_id,
          student_name,
          student_email,
          plan,
          status,
          unit_amount,
          currency,
          interval,
          interval_count,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          collection_paused,
          card_brand,
          card_last4,
          created_at,
          profiles:profile_id (
            id,
            full_name,
            email,
            avatar_url,
            billing_exempt
          )
        `,
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select(
          "id, subscription_id, profile_id, amount_cents, amount_refunded_cents, paid_at",
        )
        .order("paid_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, billing_exempt, created_at")
        .eq("role", "student"),
    ]);

  const latestPaymentBySub = new Map<
    string,
    { id: string; amount_cents: number; amount_refunded_cents: number; paid_at: string | null }
  >();
  const totalPaidBySub = new Map<string, number>();

  for (const p of payments ?? []) {
    if (!p.subscription_id) continue;
    if (!latestPaymentBySub.has(p.subscription_id)) {
      latestPaymentBySub.set(p.subscription_id, {
        id: p.id,
        amount_cents: p.amount_cents,
        amount_refunded_cents: p.amount_refunded_cents,
        paid_at: p.paid_at,
      });
    }
    totalPaidBySub.set(
      p.subscription_id,
      (totalPaidBySub.get(p.subscription_id) ?? 0) +
        (p.amount_cents - (p.amount_refunded_cents ?? 0)),
    );
  }

  const subscribedProfileIds = new Set(
    (subs ?? []).map((s) => s.profile_id).filter(Boolean) as string[],
  );

  const subscriptionRows: SubscriptionListRow[] = (subs ?? []).map((s) => {
    const profile = s.profiles as unknown as ProfileJoin;
    return {
      kind: "subscription",
      id: s.id,
      profileId: s.profile_id,
      name: profile?.full_name ?? s.student_name,
      email: profile?.email ?? s.student_email,
      avatarUrl: profile?.avatar_url ?? null,
      billingExempt: profile?.billing_exempt ?? false,
      plan: s.plan as BillingPlan | null,
      status: s.status as SubscriptionStatus,
      unitAmount: s.unit_amount,
      currency: s.currency,
      interval: s.interval,
      intervalCount: s.interval_count,
      currentPeriodStart: s.current_period_start,
      currentPeriodEnd: s.current_period_end,
      cancelAtPeriodEnd: s.cancel_at_period_end,
      collectionPaused: s.collection_paused,
      cardBrand: s.card_brand,
      cardLast4: s.card_last4,
      createdAt: s.created_at,
      totalPaidCents: totalPaidBySub.get(s.id) ?? 0,
      latestPayment: latestPaymentBySub.get(s.id) ?? null,
    };
  });

  const incompleteRows: SubscriptionListRow[] = (students ?? [])
    .filter((p) => !subscribedProfileIds.has(p.id))
    .map((p) => ({
      kind: "no_subscription",
      id: p.id,
      profileId: p.id,
      name: p.full_name,
      email: p.email,
      avatarUrl: p.avatar_url,
      billingExempt: p.billing_exempt,
      plan: null,
      status: null,
      unitAmount: null,
      currency: "eur",
      interval: null,
      intervalCount: 1,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      collectionPaused: false,
      cardBrand: null,
      cardLast4: null,
      createdAt: p.created_at,
      totalPaidCents: 0,
      latestPayment: null,
    }));

  const rows = [...subscriptionRows, ...incompleteRows];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Subscrições</h2>
        <p className="text-sm text-muted-foreground">
          Pausar, cancelar, mudar plano, reembolsar ou conceder cortesia.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="space-y-2 p-10 text-center">
          <p className="font-medium">Ainda não há alunos</p>
          <p className="text-sm text-muted-foreground">
            Quando um aluno se registar, aparece aqui.
          </p>
        </Card>
      ) : (
        <SubscriptionsList subscriptions={rows} />
      )}
    </div>
  );
}
