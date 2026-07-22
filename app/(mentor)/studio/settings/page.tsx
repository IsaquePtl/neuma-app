import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "@/components/settings-view";

export default async function MentorSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, cal_username, mentor_style_notes")
    .eq("id", user!.id)
    .single();

  return (
    <SettingsView
      name={profile?.full_name ?? null}
      email={profile?.email ?? user!.email ?? ""}
      role="mentor"
      calUsername={profile?.cal_username}
      mentorStyleNotes={profile?.mentor_style_notes}
    />
  );
}
