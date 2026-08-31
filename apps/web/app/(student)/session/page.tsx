import Link from "next/link";
import {
  ChevronRight,
  History,
  MessageCircle,
  MessageSquareText,
  Phone,
  Star,
  Video,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { CalBookButton } from "@/components/calcom-embed";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  checkInBlockedMessage,
  getCheckInAllowance,
} from "@/lib/checkins/allowance";
import {
  loadStudentUnviewedFeedback,
} from "@/lib/feedbacks/student";
import { formatDate } from "@/lib/labels";
import {
  loadMyMentor,
  loadMyPathWithNodes,
  STUDENT_VISIBLE_PATH_STATUSES,
} from "@/lib/students/queries";
import { cn } from "@/lib/utils";

function mentorWhatsAppUrl(whatsapp: string | null | undefined) {
  const raw =
    (whatsapp || process.env.NEXT_PUBLIC_MENTOR_WHATSAPP || "938909170").replace(
      /\D/g,
      "",
    );
  return `https://api.whatsapp.com/send/?phone=${raw}&text&type=phone_number&app_absent=0`;
}

/**
 * Mobile/tablet: coluna centrada no ecrã (ligeiramente mais abaixo do centro),
 * como em Geral. Desktop: coluna de leitura centrada na área ao lado da sidebar.
 */
const SESSION_VIEWPORT =
  "neuma-mobile-viewport flex w-full flex-col justify-center gap-3 overflow-hidden overscroll-none pb-2 " +
  "desktop:mx-auto desktop:max-w-3xl desktop:min-h-0 desktop:flex-1 desktop:justify-center desktop:gap-6 desktop:overflow-visible desktop:pb-4";

/** Gradient discreto no botão de feedback (activo e vazio). */
const FEEDBACK_BTN =
  "h-[3.75rem] w-full gap-2 border border-white/12 bg-gradient-to-br from-[var(--neuma-coral)]/22 via-[var(--neuma-lavender)]/12 to-[var(--neuma-blue)]/25 text-base font-semibold text-foreground shadow-none hover:from-[var(--neuma-coral)]/32 hover:via-[var(--neuma-lavender)]/16 hover:to-[var(--neuma-blue)]/35 hover:text-foreground disabled:pointer-events-none disabled:opacity-55 disabled:saturate-75";

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

  const [mentor, { data: activePath }, { data: anyPath }, { data: checkIns }, { data: me }] =
    await Promise.all([
      loadMyMentor(user!.id),
      supabase
        .from("paths")
        .select("id, title, status")
        .eq("student_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("paths")
        .select("id")
        .eq("student_id", user!.id)
        .in("status", STUDENT_VISIBLE_PATH_STATUSES)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("check_ins")
        .select("id, status")
        .eq("student_id", user!.id),
      supabase
        .from("profiles")
        .select("can_book_sessions")
        .eq("id", user!.id)
        .maybeSingle(),
    ]);

  const WHATSAPP_URL = mentorWhatsAppUrl(mentor?.whatsapp);
  const hasPath = Boolean(anyPath?.id);
  const canBookSessions = me?.can_book_sessions !== false;

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

  // Check-in: só com percurso; nível actual se existir
  const checkInHref = activeNode
    ? `/checkins/new?node=${activeNode.id}`
    : "/checkins/new";

  const checkInAllowance = activeNode
    ? await getCheckInAllowance(supabase, activeNode.id, user!.id)
    : null;
  const canSubmitCheckIn = !activeNode || (checkInAllowance?.allowed ?? true);
  const checkInBlocked = checkInAllowance
    ? checkInBlockedMessage(checkInAllowance)
    : null;

  const { nodes } = await loadMyPathWithNodes(user!.id);

  const unviewedFeedback = nodes.length
    ? await loadStudentUnviewedFeedback(supabase, user!.id, nodes)
    : { count: 0, items: [], unviewedByNodeId: new Map<string, number>() };
  const unviewedCount = unviewedFeedback.count;

  return (
    <div className={SESSION_VIEWPORT}>
      <header className="shrink-0">
        {mentor ? (
          <Link
            href="/session/mentor"
            className={cn(
              "group flex items-center gap-3 rounded-2xl outline-none",
              "transition-colors hover:bg-white/[0.04]",
              "focus-visible:ring-2 focus-visible:ring-white/25",
              "-mx-1.5 px-1.5 py-1",
            )}
            aria-label={`Ver perfil de ${mentor.full_name ?? "mentor"}`}
          >
            <UserAvatar
              name={mentor.full_name}
              email={mentor.email}
              avatarUrl={mentor.avatar_url}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Mentor
              </p>
              <h1 className="truncate text-[1.2rem] font-bold tracking-tight leading-snug">
                {mentor.full_name ?? "O teu mentor"}
              </h1>
              {activeNode ? (
                <p className="truncate text-[0.8125rem] text-muted-foreground">
                  Nível actual: {activeNode.title}
                  {activeNode.due_date
                    ? ` · até ${formatDate(activeNode.due_date)}`
                    : ""}
                </p>
              ) : activePath ? (
                <p className="truncate text-[0.8125rem] text-muted-foreground">
                  {activePath.title}
                </p>
              ) : null}
            </div>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
              aria-hidden
            />
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <UserAvatar name={null} email={null} avatarUrl={null} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Mentor
              </p>
              <h1 className="truncate text-[1.2rem] font-bold tracking-tight leading-snug">
                O teu mentor
              </h1>
            </div>
          </div>
        )}
      </header>

      {reviewed === "1" ? (
        <p className="shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Obrigado pelo teu feedback — já ficou registado.
        </p>
      ) : null}

      <section id="agendar" className="grid shrink-0 gap-2.5">
        {hasPath && canSubmitCheckIn ? (
          <Button
            render={<Link href={checkInHref} />}
            nativeButton={false}
            size="lg"
            className="h-[3.5rem] w-full gap-2 text-base font-semibold"
          >
            <Video className="size-5" /> Fazer check-in
          </Button>
        ) : (
          <div className="grid gap-1.5">
            <Button
              size="lg"
              disabled
              className="h-[3.5rem] w-full gap-2 text-base font-semibold"
            >
              <Video className="size-5" /> Fazer check-in
            </Button>
            <p className="-mt-0.5 text-center text-xs leading-snug text-muted-foreground">
              {!hasPath
                ? "O check-in fica disponível quando o teu percurso estiver ativo."
                : checkInBlocked}
            </p>
          </div>
        )}

        {unviewedCount > 0 ? (
          <Button
            render={<Link href="/session/feedback" />}
            nativeButton={false}
            size="lg"
            variant="ghost"
            className={cn(FEEDBACK_BTN, "relative h-[3.5rem]")}
          >
            <MessageSquareText className="size-5" />
            {unviewedCount > 1
              ? `Ver feedback (${unviewedCount})`
              : "Ver feedback"}
            <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-[var(--neuma-coral)] px-1.5 text-[10px] font-semibold text-white">
              {unviewedCount > 9 ? "9+" : unviewedCount}
            </span>
          </Button>
        ) : (
          <Button
            size="lg"
            variant="ghost"
            disabled
            className={cn(FEEDBACK_BTN, "h-[3.5rem]")}
          >
            <MessageSquareText className="size-5" /> Sem feedbacks de momento
          </Button>
        )}

        {canBookSessions ? (
          <CalBookButton
            calLink={`${calUser}/sessao-de-duvidas`}
            namespace="sessao-de-duvidas"
            eventType="sessao-de-duvidas"
            label="Agendar sessão de dúvidas"
            size="lg"
            className="[&_button]:h-[3.5rem]"
          />
        ) : (
          <div className="grid gap-1.5">
            <Button
              size="lg"
              disabled
              className="h-[3.5rem] w-full gap-2 text-base font-semibold"
            >
              <Phone className="size-5" /> Agendar sessão de dúvidas
            </Button>
            <p className="-mt-0.5 text-center text-xs leading-snug text-muted-foreground">
              O agendamento de sessões não está disponível de momento.
            </p>
          </div>
        )}

        <Button
          render={<Link href="/checkins" />}
          nativeButton={false}
          size="lg"
          variant="secondary"
          className={cn(
            "relative h-[3.5rem] w-full gap-2 text-base font-semibold",
          )}
        >
          <History className="size-5" /> Ver histórico
          {revisionCount > 0 ? (
            <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-[var(--neuma-coral)] px-1.5 text-[10px] font-semibold text-white">
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
          className="h-[3.5rem] w-full gap-2 text-base font-semibold"
        >
          <MessageCircle className="size-5" /> WhatsApp
        </Button>

        <Button
          render={<Link href="/session/review" />}
          nativeButton={false}
          size="lg"
          variant="secondary"
          className="h-[3.5rem] w-full gap-2 text-base font-semibold"
        >
          <Star className="size-5" /> Deixar um feedback
        </Button>
      </section>
    </div>
  );
}
