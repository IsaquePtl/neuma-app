import Link from "next/link";
import {
  CalendarClock,
  CalendarPlus,
  Headphones,
  History,
  Video,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { CalBookButton } from "@/components/calcom-embed";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default async function StudentSessionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: mentor }, { data: activePath }, { data: checkIns }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, avatar_url, cal_username")
        .eq("role", "mentor")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("paths")
        .select("id, title, status")
        .eq("student_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("check_ins")
        .select("id, status")
        .eq("student_id", user!.id),
    ]);

  const { data: activeNode } = activePath
    ? await supabase
        .from("nodes")
        .select("id, title, due_date, status")
        .eq("path_id", activePath.id)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };

  const calUser =
    mentor?.cal_username ||
    process.env.NEXT_PUBLIC_CALCOM_USERNAME ||
    "isaque-portilho-nutfa9";

  const revisionCount =
    checkIns?.filter((c) => c.status === "needs_revision").length ?? 0;

  const checkInHref = activeNode
    ? `/checkins/new?node=${activeNode.id}`
    : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-2">
      <header className="flex items-center gap-3">
        <UserAvatar
          name={mentor?.full_name}
          email={mentor?.email}
          avatarUrl={mentor?.avatar_url}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Mentoria 1:1
          </p>
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {mentor?.full_name ?? "O teu mentor"}
          </h1>
          {activeNode ? (
            <p className="truncate text-xs text-muted-foreground">
              {activeNode.title}
              {activeNode.due_date
                ? ` · até ${formatDate(activeNode.due_date)}`
                : ""}
            </p>
          ) : activePath ? (
            <p className="truncate text-xs text-muted-foreground">
              {activePath.title}
            </p>
          ) : null}
        </div>
        <Headphones className="size-5 shrink-0 text-muted-foreground" />
      </header>

      <section className="grid gap-3">
        {checkInHref ? (
          <Button
            render={<Link href={checkInHref} />}
            nativeButton={false}
            size="lg"
            className="h-14 w-full gap-2 text-base font-semibold"
          >
            <Video className="size-5" /> Fazer check-in
          </Button>
        ) : (
          <Button
            size="lg"
            disabled
            className="h-14 w-full gap-2 text-base font-semibold"
          >
            <Video className="size-5" /> Fazer check-in
          </Button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            render={<Link href="#agenda" />}
            nativeButton={false}
            size="lg"
            variant="secondary"
            className="h-14 gap-2 text-base font-semibold"
          >
            <CalendarPlus className="size-5" /> Agendar
          </Button>
          <Button
            render={<Link href="/checkins" />}
            nativeButton={false}
            size="lg"
            variant="secondary"
            className={cn(
              "relative h-14 gap-2 text-base font-semibold",
            )}
          >
            <History className="size-5" /> Histórico
            {revisionCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-[var(--neuma-coral)] px-1.5 text-[10px] font-semibold text-white">
                {revisionCount > 9 ? "9+" : revisionCount}
              </span>
            ) : null}
          </Button>
        </div>

        {activeNode?.due_date ? (
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            Prazo do bloco: {formatDate(activeNode.due_date)}
          </p>
        ) : null}
      </section>

      <section id="agenda" className="scroll-mt-24 space-y-3 pb-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Agendar chamada
          </h2>
          <p className="text-sm text-muted-foreground">
            Sessão de 30 minutos
            {mentor?.full_name ? ` com ${mentor.full_name}` : ""}.
          </p>
        </div>
        <CalBookButton
          calLink={`${calUser}/30min`}
          namespace="30min"
          eventType="30min"
          description=""
        />
      </section>
    </div>
  );
}
