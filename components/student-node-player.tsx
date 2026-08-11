import Link from "next/link";
import {
  Video,
  MessageSquare,
  CalendarClock,
  ExternalLink,
  Clock,
  Paperclip,
} from "lucide-react";

import type {
  StudentNode,
  StudentUpcomingBooking,
} from "@/lib/students/queries";
import { Button } from "@/components/ui/button";
import { NodeKindBadge } from "@/components/status-badges";
import { VideoEmbed, toEmbedUrl } from "@/components/video-embed";
import { CalBookButton } from "@/components/calcom-embed";
import { CheckpointQuiz } from "@/components/checkpoint-quiz";
import { formatDate, formatDateTime } from "@/lib/labels";

function GoogleMeetMark({ className }: { className?: string }) {
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
          aparecem o <span className="text-foreground/90">dia, horário</span> e
          o <span className="text-foreground/90">link do Google Meet</span>.
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
            {booking.title ?? "Sessão 1:1"}
          </p>
        </div>
      </div>

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
            <span className="truncate">Entrar na call</span>
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

/** Anexo de apoio no estilo to-do (Sessão / Check-point). */
function SupportAttachmentButton({
  url,
  label = "Abrir anexo de apoio",
}: {
  url: string;
  label?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm transition-colors hover:bg-white/[0.07]"
    >
      <span className="inline-flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
          <Paperclip className="size-3.5 text-[var(--neuma-coral)]" />
        </span>
        <span className="truncate font-medium">{label}</span>
      </span>
      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

function NodeMeta({ node }: { node: StudentNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NodeKindBadge kind={node.kind} />
      {node.status === "completed" ? (
        <span className="text-xs font-medium text-emerald-400">Concluído</span>
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
  );
}

function CheckInActions({
  node,
  practiceStyle = false,
}: {
  node: StudentNode;
  practiceStyle?: boolean;
}) {
  if (node.status === "completed") return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        render={<Link href={`/checkins/new?node=${node.id}`} />}
        nativeButton={false}
        className="gap-2"
      >
        <Video className="size-4" />
        {practiceStyle ? "Fazer check-in" : "Confirmar que concluíste"}
      </Button>
      {practiceStyle ? (
        <Button
          render={<Link href="/session" />}
          nativeButton={false}
          variant="secondary"
          className="gap-2"
        >
          <MessageSquare className="size-4" /> Falar no 1:1
        </Button>
      ) : null}
    </div>
  );
}

function SessionLayout({
  node,
  mentorName,
  calUser,
  upcomingBooking,
}: {
  node: StudentNode;
  mentorName?: string | null;
  calUser: string;
  upcomingBooking: StudentUpcomingBooking | null;
}) {
  return (
    <div className="space-y-6">
      <NodeMeta node={node} />
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
        <div className="whitespace-pre-wrap text-sm text-muted-foreground">
          {node.content_body}
        </div>
      ) : null}

      {node.resource_url ? (
        <SupportAttachmentButton url={node.resource_url} />
      ) : null}

      <div className="space-y-3">
        <CallBookingCard booking={upcomingBooking} mentorName={mentorName} />
        <CalBookButton
          calLink={`${calUser}/30min`}
          namespace={`student-path-node-${node.id}`}
          eventType="30min"
          label={upcomingBooking ? "Alterar agendamento" : "Agendar sessão"}
          description=""
          showExternalLink={false}
          size="lg"
        />
      </div>
    </div>
  );
}

function RecordingLayout({ node }: { node: StudentNode }) {
  return (
    <div className="space-y-6">
      <NodeMeta node={node} />
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {node.title}
      </h1>

      {node.resource_url ? (
        <VideoEmbed
          url={node.resource_url}
          title={node.title}
          className="aspect-video w-full overflow-hidden rounded-xl border border-white/10"
          fallbackLabel="Abrir gravação"
        />
      ) : (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-muted-foreground">
          Ainda sem vídeo neste nível.
        </p>
      )}

      {node.description ? (
        <p className="whitespace-pre-wrap text-muted-foreground">
          {node.description}
        </p>
      ) : null}

      {node.content_body ? (
        <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          {node.content_body}
        </div>
      ) : null}

      <CheckInActions node={node} />
    </div>
  );
}

function PracticeLayout({ node }: { node: StudentNode }) {
  const hasVideo = Boolean(node.resource_url && toEmbedUrl(node.resource_url));

  return (
    <div className="space-y-6">
      <NodeMeta node={node} />
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
        <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          {node.content_body}
        </div>
      ) : null}

      {node.resource_url ? (
        hasVideo ? (
          <VideoEmbed
            url={node.resource_url}
            title={node.title}
            fallbackLabel="Abrir recurso"
          />
        ) : (
          <SupportAttachmentButton
            url={node.resource_url}
            label="Abrir ficheiro / link"
          />
        )
      ) : null}

      <CheckInActions node={node} practiceStyle />
    </div>
  );
}

function CheckpointLayout({ node }: { node: StudentNode }) {
  return (
    <div className="space-y-6">
      <NodeMeta node={node} />
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
        <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          {node.content_body}
        </div>
      ) : null}

      <CheckpointQuiz nodeId={node.id} />

      {node.resource_url ? (
        <SupportAttachmentButton url={node.resource_url} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {node.status !== "completed" ? (
          <Button
            render={<Link href={`/checkins/new?node=${node.id}`} />}
            nativeButton={false}
            variant="secondary"
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

  if (node.kind === "call") {
    return (
      <SessionLayout
        node={node}
        mentorName={mentorName}
        calUser={calUser}
        upcomingBooking={upcomingBooking}
      />
    );
  }

  if (node.kind === "lesson" || node.kind === "resource") {
    return <RecordingLayout node={node} />;
  }

  if (node.kind === "milestone") {
    return <CheckpointLayout node={node} />;
  }

  return <PracticeLayout node={node} />;
}
