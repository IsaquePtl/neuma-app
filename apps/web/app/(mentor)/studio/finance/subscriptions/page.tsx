import { FinanceSubscriptionsList } from "@/components/finance-subscriptions-list";
import type { FinanceSubscriptionRow } from "@/components/finance-subscriptions-list";
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

  const [{ data: subs }, { data: payments }] = await Promise.all([
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
        current_period_end,
        cancel_at_period_end,
        collection_paused,
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
        "id, subscription_id, amount_cents, amount_refunded_cents, paid_at",
      )
      .order("paid_at", { ascending: false }),
  ]);

  const latestBySub = new Map<
    string,
    {
      id: string;
      amount_cents: number;
      amount_refunded_cents: number;
      paid_at: string | null;
    }
  >();
  for (const p of payments ?? []) {
    if (!p.subscription_id) continue;
    if (latestBySub.has(p.subscription_id)) continue;
    latestBySub.set(p.subscription_id, {
      id: p.id,
      amount_cents: p.amount_cents,
      amount_refunded_cents: p.amount_refunded_cents,
      paid_at: p.paid_at,
    });
  }

  const rows: FinanceSubscriptionRow[] = (subs ?? []).map((s) => {
    const profile = s.profiles as unknown as ProfileJoin;
    return {
      id: s.id,
      profile_id: s.profile_id,
      student_name: profile?.full_name ?? s.student_name,
      student_email: profile?.email ?? s.student_email,
      avatar_url: profile?.avatar_url ?? null,
      billing_exempt: profile?.billing_exempt ?? false,
      plan: s.plan as BillingPlan | null,
      status: s.status as SubscriptionStatus,
      unit_amount: s.unit_amount,
      currency: s.currency,
      interval: s.interval,
      interval_count: s.interval_count,
      current_period_end: s.current_period_end,
      cancel_at_period_end: s.cancel_at_period_end,
      collection_paused: s.collection_paused,
      created_at: s.created_at,
      latest_payment: latestBySub.get(s.id) ?? null,
    };
  });

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
          <p className="font-medium">Ainda não há subscrições</p>
          <p className="text-sm text-muted-foreground">
            Quando um aluno pagar, a subscrição aparece aqui via Stripe.
          </p>
        </Card>
      ) : (
        <FinanceSubscriptionsList subscriptions={rows} />
      )}
    </div>
  );
}
