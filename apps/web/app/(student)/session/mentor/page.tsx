import { MessageCircle } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { formatDate } from "@/lib/labels";
import {
  instagramProfileUrl,
  normalizeInstagramHandle,
  whatsappChatUrl,
} from "@/lib/social-links";
import {
  loadMentorSharedHistory,
  loadMyMentor,
  type MentorHistoryEvent,
} from "@/lib/students/queries";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * Desktop: max-width ≈ conteúdo a 1450px (1450 − sidebar − px-10×2 ≈ 1114 → 70rem),
 * centrada na coluna principal. Mobile: w-full.
 */
const MENTOR_VIEWPORT =
  "neuma-mobile-viewport flex w-full flex-col justify-start gap-8 overflow-y-auto overscroll-none pb-8 " +
  "desktop:mx-auto desktop:max-w-[70rem] desktop:h-auto desktop:min-h-0 desktop:overflow-visible desktop:pb-4";

export default async function StudentMentorProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const mentor = await loadMyMentor(user!.id);

  if (!mentor) {
    return (
      <div className={MENTOR_VIEWPORT}>
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Mentor
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
        </header>
        <p className="text-sm text-muted-foreground">
          Ainda não tens um mentor vinculado.
        </p>
      </div>
    );
  }

  const history = await loadMentorSharedHistory(user!.id, mentor.id);

  const igHandle = normalizeInstagramHandle(mentor.instagram ?? "") || null;
  const igUrl = igHandle ? instagramProfileUrl(igHandle) : null;
  const waUrl = whatsappChatUrl(mentor.whatsapp ?? "");
  const bio = mentor.bio?.trim() || null;

  return (
    <div className={MENTOR_VIEWPORT}>
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <UserAvatar
          name={mentor.full_name}
          email={mentor.email}
          avatarUrl={mentor.avatar_url}
          size="xl"
          className="size-[6.5rem] text-3xl ring-2 ring-white/10"
        />

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Mentor
          </p>
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-3xl">
            {mentor.full_name ?? "O teu mentor"}
          </h1>
        </div>

        {bio ? (
          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-muted-foreground">
            {bio}
          </p>
        ) : null}

        {igUrl || waUrl ? (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {igUrl && igHandle ? (
              <a
                href={igUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl px-3.5",
                  "border border-white/10 bg-white/[0.04] text-sm font-medium text-foreground/90",
                  "transition-colors hover:bg-white/[0.07] hover:text-foreground",
                )}
              >
                <InstagramMark className="size-4 shrink-0" />
                @{igHandle}
              </a>
            ) : null}
            {waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl px-3.5",
                  "border border-white/10 bg-white/[0.04] text-sm font-medium text-foreground/90",
                  "transition-colors hover:bg-white/[0.07] hover:text-foreground",
                )}
              >
                <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
                WhatsApp
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <section className="space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Juntos
          </p>
          <h2 className="text-lg font-semibold tracking-tight">
            Histórico de eventos
          </h2>
        </header>

        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ainda não há eventos partilhados.
          </p>
        ) : (
          <ol className="relative ms-3 space-y-0 border-l border-white/10 ps-6">
            {history.map((event) => (
              <HistoryItem key={event.id} event={event} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function HistoryItem({ event }: { event: MentorHistoryEvent }) {
  return (
    <li className="relative pb-6 last:pb-0">
      <span
        className="absolute -start-[0.3125rem] top-1.5 size-2 rounded-full bg-foreground/35 ring-4 ring-[var(--background)]"
        aria-hidden
      />
      <div className="ml-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {event.label}
          </p>
          <time
            dateTime={event.at}
            className="shrink-0 text-[11px] text-muted-foreground/80"
          >
            {formatDate(event.at)}
          </time>
        </div>
        {event.detail ? (
          <p className="mt-1 text-sm leading-snug text-foreground/90">
            {event.detail}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function InstagramMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.75"
        className="text-muted-foreground"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        stroke="currentColor"
        strokeWidth="1.75"
        className="text-muted-foreground"
      />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" className="text-muted-foreground" />
    </svg>
  );
}
