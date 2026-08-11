import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  loadMyPathWithNodes,
  loadMentorCalUsername,
  loadMyUpcomingBooking,
} from "@/lib/students/queries";
import { StudentNodePlayer } from "@/components/student-node-player";

export default async function StudentNodePage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const { nodeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ path, nodes }, mentor, upcomingBooking] = await Promise.all([
    loadMyPathWithNodes(user!.id),
    loadMentorCalUsername(),
    loadMyUpcomingBooking(user!.id),
  ]);

  if (!path) redirect("/path");

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) notFound();

  const activeIndex = nodes.findIndex((n) => n.status === "active");
  const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
  const isPast =
    node.status === "completed" ||
    (activeIndex >= 0 && nodeIndex >= 0 && nodeIndex < activeIndex);
  const isActive = node.status === "active";

  // Só futuros (depois do activo) ficam inacessíveis
  if (!isActive && !isPast) {
    redirect("/path");
  }

  return (
    <div className="space-y-6 pb-4">
      <StudentNodePlayer
        node={node}
        mentorName={mentor?.full_name}
        calUsername={mentor?.cal_username}
        upcomingBooking={node.kind === "call" ? upcomingBooking : null}
      />
    </div>
  );
}
