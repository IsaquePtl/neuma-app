import Link from "next/link";
import {
  CalendarPlus,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Video,
} from "lucide-react";

import { CheckInStatusBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";
import { formatDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type MentorshipThreadItem =
  | {
      type: "checkin";
      id: string;
      createdAt: string;
      notes: string | null;
      videoUrl: string | null;
      status: "pending" | "approved" | "needs_revision";
      nodeTitle: string | null;
      nodeId: string | null;
    }
  | {
      type: "feedback";
      id: string;
      createdAt: string;
      notes: string | null;
      nextSteps: string | null;
      videoUrl: string | null;
      checkInId: string;
      nodeTitle: string | null;
    };

export function MentorshipThread({
  items,
  mentorName,
  mentorAvatarUrl,
  studentName,
}: {
  items: MentorshipThreadItem[];
  mentorName: string | null | undefined;
  mentorAvatarUrl?: string | null;
  studentName: string | null | undefined;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-white/5">
          <MessageSquare className="size-5 text-[var(--neuma-coral)]" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">A conversa começa aqui</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Envia um check-in, uma dúvida ou agenda uma chamada. O feedback do
            mentor aparece neste fio, como numa conversa 1:1.
          </p>
        </div>
        <Link
          href="#agenda"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--neuma-coral)]"
        >
          <CalendarPlus className="size-4" /> Agendar chamada
        </Link>
      </div>
    );
  }

  return (
    <div
      id="conversa"
      className="flex flex-1 flex-col gap-4 px-3 py-4 sm:px-4"
    >
      {items.map((item) => {
        if (item.type === "checkin") {
          return (
            <article
              key={`c-${item.id}`}
              className="ml-8 flex flex-col items-end gap-1 sm:ml-16"
            >
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{studentName?.split(" ")[0] ?? "Tu"}</span>
                <span>·</span>
                <time dateTime={item.createdAt}>
                  {formatDateTime(item.createdAt)}
                </time>
                <CheckInStatusBadge status={item.status} />
              </div>
              <div className="max-w-[92%] space-y-2 rounded-2xl rounded-br-md bg-gradient-to-br from-[var(--neuma-coral)]/90 to-[var(--neuma-blue)]/80 px-4 py-3 text-sm text-white shadow-md sm:max-w-[80%]">
                {item.nodeTitle ? (
                  <p className="text-[11px] font-medium uppercase tracking-wider text-white/75">
                    Check-in · {item.nodeTitle}
                  </p>
                ) : null}
                {item.notes ? (
                  <p className="whitespace-pre-wrap">{item.notes}</p>
                ) : (
                  <p className="text-white/80">Check-in enviado</p>
                )}
                {item.videoUrl ? (
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-white underline-offset-2 hover:underline"
                  >
                    <Video className="size-3.5" /> Ver vídeo
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
                {item.status === "needs_revision" && item.nodeId ? (
                  <Link
                    href={`/checkins/new?node=${item.nodeId}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-white underline-offset-2 hover:underline"
                  >
                    <RefreshCw className="size-3.5" /> Reenviar
                  </Link>
                ) : null}
              </div>
              <Link
                href={`/checkins/${item.id}`}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Ver detalhe
              </Link>
            </article>
          );
        }

        return (
          <article
            key={`f-${item.id}`}
            className="mr-8 flex gap-2 sm:mr-16"
          >
            <UserAvatar
              name={mentorName}
              avatarUrl={mentorAvatarUrl}
              size="sm"
              className="mt-5"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{mentorName ?? "Mentor"}</span>
                <span>·</span>
                <time dateTime={item.createdAt}>
                  {formatDateTime(item.createdAt)}
                </time>
                <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                  Feedback
                </span>
              </div>
              <div
                className={cn(
                  "max-w-[95%] space-y-3 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-4 py-3 text-sm sm:max-w-[85%]",
                )}
              >
                {item.nodeTitle ? (
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Sobre · {item.nodeTitle}
                  </p>
                ) : null}
                {item.notes ? (
                  <p className="whitespace-pre-wrap">{item.notes}</p>
                ) : null}
                {item.nextSteps ? (
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Próximos passos
                    </p>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {item.nextSteps}
                    </p>
                  </div>
                ) : null}
                {item.videoUrl ? (
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--neuma-coral)] hover:underline"
                  >
                    <Video className="size-3.5" /> Vídeo do mentor
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
