import { redirect } from "next/navigation";

import { resolveCheckInLevelUrl } from "@/lib/journey-path/load-level-review";

export default async function CheckinDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; student?: string; path?: string }>;
}) {
  const { id } = await params;
  const { from, student, path } = await searchParams;

  const levelUrl = await resolveCheckInLevelUrl(id);
  if (levelUrl) {
    redirect(levelUrl);
  }

  const fallback = new URLSearchParams();
  if (from) fallback.set("from", from);
  if (student) fallback.set("student", student);
  if (path) fallback.set("path", path);
  const qs = fallback.toString();
  redirect(qs ? `/studio/journeys/checkins?${qs}` : "/studio/journeys/checkins");
}
