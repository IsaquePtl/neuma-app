import Link from "next/link";
import {
  Video,
  MessageSquare,
  CalendarClock,
  Sparkles,
  ExternalLink,
  Clock,
} from "lucide-react";

import type {
  StudentNode,
  StudentUpcomingBooking,
} from "@/lib/students/queries";
import { Button } from "@/components/ui/button";
import { NodeKindBadge } from "@/components/status-badges";
import { VideoEmbed } from "@/components/video-embed";
import { CalBookButton } from "@/components/calcom-embed";
import { formatDate, formatDateTime } from "@/lib/labels";

function GoogleMeetMark({ className }: { className?: string }) {
  // Ícone simples (monocromático) para evitar dependências externas.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12a4 4 0 0 1 4-4h1" />
      <path d="M21 12a4 4 0 0 1-4 4h-1" />
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M10 12h4" />
    </svg>
  );
}

function formatTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  return `${start.toLocaleTimeString("pt-PT", opts)} – ${end.toLocaleTimeString("pt-PT", opts)}`;
}

function CallBookingCard({
  booking,
  mentorName,
}: {
  booking: StudentUpcomingBooking | null;
  mentorName?: string | null;
}) {
  if (!booking) {
    return (
      <div className="student-path-step student-path-step--active space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
          Reserva
        </p>
        <p className="text-sm text-muted-foreground">
          Ainda sem marcação
          {mentorName ? ` com ${mentorName}` : ""}. Assim que agendar, aqui
          aparecem o <span className="text-foreground/90">dia, horário</span> e o{" "}
          <span className="text-foreground/90">link do Google Meet</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="student-path-step student-path-step--active space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
            Reserva confirmada
          </p>
          <p className="text-sm font-semibold tracking-tight sm:text-base">
            {booking.title ?? "Chamada 1:1"}
          </p>
        </div>
      </div>

      {/* Dia / horário discretos, acima do CTA do Meet */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-3.5 text-[var(--neuma-coral)]" />
          {formatDate(booking.start_time)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5 text-[var(--neuma-coral)]" />
          {formatTimeRange(booking.start_time, booking.end_time) ||
            formatDateTime(booking.start_time)}
        </span>
      </div>

      {booking.meet_url ? (
        <a
          href={booking.meet_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/[0.06]"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <GoogleMeetMark className="size-5 shrink-0 text-[var(--neuma-coral)]" />
            <span className="truncate">
              Entrar na call
            </span>
          </span>
          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
        </a>
      ) : (
        <p className="rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-sm text-muted-foreground">
          Link do Google Meet ainda não disponível.
        </p>
      )}
    </div>
  );
}

export function StudentNodePlayer({
  node,
  mentorName,
  calUsername,
  upcomingBooking = null,
}: {
  node: StudentNode;
  mentorName?: string | null;
  calUsername?: string | null;
  upcomingBooking?: StudentUpcomingBooking | null;
}) {
  const calUser =
    calUsername ||
    process.env.NEXT_PUBLIC_CALCOM_USERNAME ||
    "isaque-portilho-nutfa9";

  const isLesson = node.kind === "lesson" || node.kind === "resource";
  const isCall = node.kind === "call";
  const isMilestone = node.kind === "milestone";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <NodeKindBadge kind={node.kind} />
        {node.status === "completed" ? (
          <span className="text-xs font-medium text-emerald-400">
            Concluído
          </span>
        ) : node.status === "active" ? (
          <span className="text-xs font-medium text-[var(--neuma-coral)]">
            Activo
          </span>
        ) : null}
        {node.due_date ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            Até {formatDate(node.due_date)}
          </span>
        ) : null}
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {node.title}
        </h1>
        {node.description ? (
          <p className="mt-3 whitespace-pre-wrap text-muted-foreground">
            {node.description}
          </p>
        ) : null}
      </div>

      {node.content_body ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm whitespace-pre-wrap">
          {node.content_body}
        </div>
      ) : null}

      {node.resource_url ? (
        <VideoEmbed
          url={node.resource_url}
          title={node.title}
          fallbackLabel="Abrir recurso do bloco"
        />
      ) : null}

      {isCall ? (
        <div className="space-y-3">
          <CallBookingCard booking={upcomingBooking} mentorName={mentorName} />

          <div className="grid gap-3">
            <CalBookButton
              calLink={`${calUser}/30min`}
              namespace={`student-path-node-${node.id}`}
              eventType="30min"
              label={
                upcomingBooking ? "Alterar agendamento" : "Agendar chamada"
              }
              description=""
              showExternalLink={false}
              size="lg"
            />
          </div>
        </div>
      ) : null}

      {isLesson ? (
        <div className="flex flex-wrap gap-2">
          {node.status !== "completed" ? (
            <Button
              render={<Link href={`/checkins/new?node=${node.id}`} />}
              nativeButton={false}
              className="gap-2"
            >
              <Video className="size-4" /> Confirmar que concluíste
            </Button>
          ) : null}
        </div>
      ) : null}

      {node.kind === "practice" ? (
        <div className="flex flex-wrap gap-2">
          {node.status !== "completed" ? (
            <Button
              render={<Link href={`/checkins/new?node=${node.id}`} />}
              nativeButton={false}
              className="gap-2"
            >
              <Video className="size-4" /> Fazer check-in
            </Button>
          ) : null}
          <Button
            render={<Link href="/session" />}
            nativeButton={false}
            variant="secondary"
            className="gap-2"
          >
            <MessageSquare className="size-4" /> Falar no 1:1
          </Button>
        </div>
      ) : null}

      {isMilestone ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-[var(--neuma-coral)]" />
            <p className="text-sm text-muted-foreground">
              Marco do percurso — confirma quando chegares a este objectivo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {node.status !== "completed" ? (
              <Button
                render={<Link href={`/checkins/new?node=${node.id}`} />}
                nativeButton={false}
                className="gap-2"
              >
                <Video className="size-4" /> Fazer check-in
              </Button>
            ) : null}
            <Button
              render={<Link href="/session" />}
              nativeButton={false}
              variant="secondary"
              className="gap-2"
            >
              <MessageSquare className="size-4" /> Falar no 1:1
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
