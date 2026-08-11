import Link from "next/link";
import {
  History,
  MessageCircle,
  MessageSquareText,
  Star,
  Video,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { CalBookButton } from "@/components/calcom-embed";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/labels";
import { cn } from "@/lib/utils";

const WHATSAPP_URL =
  "https://api.whatsapp.com/send/?phone=938909170&text&type=phone_number&app_absent=0";

/**
 * Mobile/tablet: coluna centrada no ecrã (ligeiramente mais abaixo do centro),
 * como em Geral. Desktop: fluxo no topo.
 */
const SESSION_VIEWPORT =
  "neuma-mobile-viewport mx-auto flex w-full max-w-2xl flex-col justify-center gap-4 overflow-y-auto pb-5 " +
  "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:gap-6 desktop:overflow-visible desktop:pb-4";

/** Gradient discreto no botão de feedback (activo e vazio). */
const FEEDBACK_BTN =
  "h-14 w-full gap-2 border border-white/12 bg-gradient-to-br from-[var(--neuma-coral)]/22 via-[var(--neuma-lavender)]/12 to-[var(--neuma-blue)]/25 text-base font-semibold text-foreground shadow-none hover:from-[var(--neuma-coral)]/32 hover:via-[var(--neuma-lavender)]/16 hover:to-[var(--neuma-blue)]/35 hover:text-foreground disabled:pointer-events-none disabled:opacity-55 disabled:saturate-75";

export default async function StudentSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ reviewed?: string }>;
}) {
  const { reviewed } = await searchParams;
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

  // Check-in: nível actual se existir; senão check-in geral (sem nível)
  const checkInHref = activeNode
    ? `/checkins/new?node=${activeNode.id}`
    : "/checkins/new";

  // Feedback do nível actual (check-in com feedback ou level_feedback)
  let hasFeedback = false;
  if (activeNode) {
    const [{ data: recentCheckIns }, { data: levelFb }] = await Promise.all([
      supabase
        .from("check_ins")
        .select("id, feedback:feedbacks(id)")
        .eq("student_id", user!.id)
        .eq("node_id", activeNode.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("level_feedbacks")
        .select("id")
        .eq("node_id", activeNode.id)
        .limit(1)
        .maybeSingle(),
    ]);
    const hasCheckInFb = (recentCheckIns ?? []).some((c) => {
      const fb = Array.isArray(c.feedback) ? c.feedback[0] : c.feedback;
      return Boolean(fb);
    });
    hasFeedback = hasCheckInFb || Boolean(levelFb?.id);
  }

  return (
    <div className={SESSION_VIEWPORT}>
      <header className="flex shrink-0 items-center gap-3">
        <UserAvatar
          name={mentor?.full_name}
          email={mentor?.email}
          avatarUrl={mentor?.avatar_url}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Mentor
          </p>
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {mentor?.full_name ?? "O teu mentor"}
          </h1>
          {activeNode ? (
            <p className="truncate text-xs text-muted-foreground">
              Nível actual: {activeNode.title}
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
      </header>

      {reviewed === "1" ? (
        <p className="shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Obrigado pelo teu feedback — já ficou registado.
        </p>
      ) : null}

      <section className="grid shrink-0 gap-3">
        <Button
          render={<Link href={checkInHref} />}
          nativeButton={false}
          size="lg"
          className="h-14 w-full gap-2 text-base font-semibold"
        >
          <Video className="size-5" /> Fazer check-in
        </Button>
        {!activeNode ? (
          <p className="-mt-1 text-center text-xs text-muted-foreground">
            Sem nível activo — o check-in fica como «Sem nível associado».
          </p>
        ) : null}

        {hasFeedback ? (
          <Button
            render={<Link href="/session/feedback" />}
            nativeButton={false}
            size="lg"
            variant="ghost"
            className={FEEDBACK_BTN}
          >
            <MessageSquareText className="size-5" /> Ver feedback
          </Button>
        ) : (
          <Button
            size="lg"
            variant="ghost"
            disabled
            className={FEEDBACK_BTN}
          >
            <MessageSquareText className="size-5" /> Sem feedbacks de momento
          </Button>
        )}

        <CalBookButton
          calLink={`${calUser}/sessao-de-duvidas`}
          namespace="sessao-de-duvidas"
          eventType="sessao-de-duvidas"
          label="Agendar sessão de dúvidas"
          showExternalLink={false}
          size="lg"
        />

        <Button
          render={<Link href="/checkins" />}
          nativeButton={false}
          size="lg"
          variant="secondary"
          className={cn("relative h-14 w-full gap-2 text-base font-semibold")}
        >
          <History className="size-5" /> Ver histórico
          {revisionCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-[var(--neuma-coral)] px-1.5 text-[10px] font-semibold text-white">
              {revisionCount > 9 ? "9+" : revisionCount}
            </span>
          ) : null}
        </Button>

        <Button
          render={
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" />
          }
          nativeButton={false}
          size="lg"
          variant="secondary"
          className="h-14 w-full gap-2 text-base font-semibold"
        >
          <MessageCircle className="size-5" /> WhatsApp
        </Button>

        <Button
          render={<Link href="/session/review" />}
          nativeButton={false}
          size="lg"
          variant="secondary"
          className="h-14 w-full gap-2 text-base font-semibold"
        >
          <Star className="size-5" /> Deixar um feedback
        </Button>
      </section>
    </div>
  );
}
