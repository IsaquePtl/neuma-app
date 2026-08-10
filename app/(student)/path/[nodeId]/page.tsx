import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  loadMyPathWithNodes,
  loadMentorCalUsername,
  loadMyUpcomingBooking,
} from "@/lib/students/queries";
import { StudentNodePlayer } from "@/components/student-node-player";
import { Button } from "@/components/ui/button";

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
      <Button
        render={<Link href="/path" />}
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="-ml-1 gap-2.5 pl-1 pr-3 text-muted-foreground hover:text-foreground"
      >
        <span className="grid size-9 place-items-center rounded-full bg-white/[0.07] ring-1 ring-white/10 transition-colors group-hover/button:bg-white/12">
          <ArrowLeft className="size-5" strokeWidth={2.25} />
        </span>
        Percurso
      </Button>

      <StudentNodePlayer
        node={node}
        mentorName={mentor?.full_name}
        calUsername={mentor?.cal_username}
        upcomingBooking={node.kind === "call" ? upcomingBooking : null}
      />
    </div>
  );
}
