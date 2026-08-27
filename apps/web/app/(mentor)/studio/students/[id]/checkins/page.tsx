import { redirect } from "next/navigation";

export default async function StudentCheckinsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/studio/students/${id}`);
}
