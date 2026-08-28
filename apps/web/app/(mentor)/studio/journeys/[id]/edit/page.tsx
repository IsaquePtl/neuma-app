import { notFound } from "next/navigation";

import { JourneyPathEditView } from "@/components/journey-path-edit-view";
import { loadJourneyPathPageData } from "@/lib/journey-path/load-journey-path";

export default async function JourneyEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: newParam } = await searchParams;
  const data = await loadJourneyPathPageData(id);

  if (!data) notFound();

  return <JourneyPathEditView data={data} isNewDraft={newParam === "1"} />;
}
