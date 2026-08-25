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
import {
  cancelCalBookingFromEmbed,
  syncCalBookingFromEmbed,
} from "@/lib/actions/cal-bookings";
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
      <div className="student-path-step student-path-step--active space-y-4 !px-4 !py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
          Reserva
        </p>
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
          Ainda sem marcação
          {mentorName ? ` com ${mentorName}` : ""}. Assim que agendares, aqui
          aparecem o <span className="text-foreground/90">dia, horário</span> e
          o <span className="text-foreground/90">link do Google Meet</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="student-path-step student-path-step--active space-y-4 !px-4 !py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--neuma-coral)]">
            Reserva confirmada
          </p>
          <p className="text-base font-semibold tracking-tight sm:text-lg">
            {booking.title ?? "Sessão 1:1"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-4 text-[var(--neuma-coral)]" />
          {formatDate(booking.start_time)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4 text-[var(--neuma-coral)]" />
          {formatTimeRange(booking.start_time, booking.end_time) ||
            formatDateTime(booking.start_time)}
        </span>
      </div>

      {booking.meet_url ? (
        <a
          href={booking.meet_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3.5 text-sm font-medium transition-colors hover:bg-white/[0.06]"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <GoogleMeetMark className="size-5 shrink-0 text-[var(--neuma-coral)]" />
            <span className="truncate">Entrar na call</span>
          </span>
          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
        </a>
      ) : (
        <p className="rounded-xl border border-dashed border-white/10 px-3.5 py-3.5 text-sm text-muted-foreground">
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
}: {
  initialBooking: StudentUpcomingBooking | null;
  mentorName?: string | null;
  calUser: string;
}) {
  const router = useRouter();
  const [booking, setBooking] = useState(initialBooking);

  useEffect(() => {
    setBooking(initialBooking);
  }, [initialBooking]);

  // Se cancelar/reagendar no Cal.com (fora do embed), refresca ao voltar à app.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);

  const hasBooking = Boolean(booking);

  return (
    <div className="space-y-3">
      <CallBookingCard booking={booking} mentorName={mentorName} />
      <CalBookButton
        calLink={`${calUser}/30min`}
        namespace="30min"
        eventType="30min"
        label={hasBooking ? "Alterar agendamento" : "Agendar sessão"}
        showExternalLink={false}
        size={hasBooking ? "default" : "lg"}
        variant={hasBooking ? "secondary" : "default"}
        className={hasBooking ? "pt-1 [&_button]:h-11 [&_button]:text-[0.9375rem]" : undefined}
        onBookingSuccess={async (data) => {
          if (!data.startTime || !data.endTime) return;
          const previousUid =
            data.previousUid ??
            (data.isReschedule ? booking?.cal_booking_uid : null) ??
            null;
          const next: StudentUpcomingBooking = {
            id: data.uid || `local-${Date.now()}`,
            cal_booking_uid: data.uid || `local-${Date.now()}`,
            start_time: data.startTime,
            end_time: data.endTime,
            title: data.title ?? "Sessão 1:1",
            meet_url: data.videoCallUrl ?? null,
            status: "accepted",
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
                previousUid:
                  previousUid && previousUid !== data.uid
                    ? previousUid
                    : null,
              });
            }
          } catch (err) {
            console.error("[cal:sync-embed]", err);
          }
          router.refresh();
        }}
        onBookingCancelled={async (data) => {
          const uid = data.uid ?? booking?.cal_booking_uid ?? null;
          const previous = booking;
          setBooking(null);
          try {
            if (uid && !uid.startsWith("local-")) {
              await cancelCalBookingFromEmbed({ uid });
            } else if (previous?.cal_booking_uid && !previous.cal_booking_uid.startsWith("local-")) {
              await cancelCalBookingFromEmbed({
                uid: previous.cal_booking_uid,
              });
            }
          } catch (err) {
            console.error("[cal:cancel-embed]", err);
            // Se falhar a persistência, repõe o estado local
            setBooking(previous);
          }
          router.refresh();
        }}
      />
    </div>
  );
}
