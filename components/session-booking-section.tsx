"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Clock,
  ExternalLink,
} from "lucide-react";

import { CalBookButton } from "@/components/calcom-embed";
import type { StudentUpcomingBooking } from "@/lib/students/queries";
import { syncCalBookingFromEmbed } from "@/lib/actions/cal-bookings";
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

export function SessionBookingSection({
  initialBooking,
  mentorName,
  calUser,
  nodeId,
  namespace,
}: {
  initialBooking: StudentUpcomingBooking | null;
  mentorName?: string | null;
  calUser: string;
  nodeId: string;
  namespace?: string;
}) {
  const router = useRouter();
  const [booking, setBooking] = useState(initialBooking);

  useEffect(() => {
    setBooking(initialBooking);
  }, [initialBooking]);

  const hasBooking = Boolean(booking);

  return (
    <div className="space-y-3">
      <CallBookingCard booking={booking} mentorName={mentorName} />
      <CalBookButton
        calLink={`${calUser}/30min`}
        namespace={namespace ?? `student-path-node-${nodeId}`}
        eventType="30min"
        label={hasBooking ? "Alterar agendamento" : "Agendar sessão"}
        description=""
        showExternalLink={false}
        size={hasBooking ? "default" : "lg"}
        variant={hasBooking ? "secondary" : "default"}
        className={hasBooking ? "pt-1" : undefined}
        onBookingSuccess={async (data) => {
          if (!data.startTime || !data.endTime) return;
          const next: StudentUpcomingBooking = {
            id: data.uid || `local-${Date.now()}`,
            start_time: data.startTime,
            end_time: data.endTime,
            title: data.title ?? "Sessão 1:1",
            meet_url: data.videoCallUrl ?? null,
            status: data.isReschedule ? "rescheduled" : "accepted",
          };
          setBooking(next);
          try {
            if (data.uid) {
              await syncCalBookingFromEmbed({
                uid: data.uid,
                title: data.title,
                startTime: data.startTime,
                endTime: data.endTime,
                meetUrl: data.videoCallUrl,
                status: data.status,
                isReschedule: data.isReschedule,
              });
            }
          } catch (err) {
            console.error("[cal:sync-embed]", err);
          }
          router.refresh();
        }}
      />
    </div>
  );
}
