import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "@/components/settings-view";
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

  return (
    <SettingsView
      name={profile?.full_name ?? null}
      email={profile?.email ?? user!.email ?? ""}
      role="student"
      avatarUrl={profile?.avatar_url}
      bio={profile?.bio}
      instagram={profile?.instagram}
      whatsapp={profile?.whatsapp}
      footerExtra={
        billingOn ? (
          <Link
            href="/settings/subscription"
            className="inline-flex h-9 items-center justify-center px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver subscrição
          </Link>
        ) : null
      }
    />
  );
}
