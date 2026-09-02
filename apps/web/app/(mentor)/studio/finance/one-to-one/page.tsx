import { OneToOneInvitesPanel } from "@/components/one-to-one-invites-panel";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FinanceOneToOnePage() {
  const supabase = await createClient();
  const { data: invites } = await supabase
    .from("one_to_one_invites")
    .select(
      "id, email, full_name, amount_cents, currency, interval, interval_count, status, notes, expires_at, redeemed_at, created_at",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Neuma 1:1</h2>
        <p className="text-sm text-muted-foreground">
          Convites com preço à medida para mentoria individual.
        </p>
      </div>

      <OneToOneInvitesPanel invites={invites ?? []} />
    </div>
  );
}
