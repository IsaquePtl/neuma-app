import { redirect } from "next/navigation";

export default async function LegacyTemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/studio/library?compose=${id}`);
}
