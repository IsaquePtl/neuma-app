"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CalBookButton } from "@/components/calcom-embed";
import { syncCalBookingFromEmbed } from "@/lib/actions/cal-bookings";
import { getCalEventTypeSlug, getCalLink } from "@/lib/cal-config";

/** Botão compacto Cal — mesmo embed do aluno, para o header do calendário. */
export function MentorCalBookButton({
  calUser,
}: {
  calUser: string;
}) {
  const router = useRouter();
  const eventType = getCalEventTypeSlug();

  return (
    <CalBookButton
      calLink={getCalLink(calUser, eventType)}
      namespace={eventType}
      eventType={eventType}
      label="Agendar sessão"
      size="default"
      variant="default"
      className="[&_button]:h-8 [&_button]:gap-1.5 [&_button]:px-3 [&_button]:text-sm [&_button]:font-medium sm:w-auto [&_button]:w-auto"
      onBookingSuccess={async (data) => {
        if (!data.uid || !data.startTime || !data.endTime) {
          router.refresh();
          return;
        }
        try {
          await syncCalBookingFromEmbed({
            uid: data.uid,
            title: data.title,
            startTime: data.startTime,
            endTime: data.endTime,
            meetUrl: data.videoCallUrl,
            status: data.status,
            isReschedule: data.isReschedule,
            previousUid: data.previousUid,
            attendeeEmail: data.attendeeEmail,
            attendeeName: data.attendeeName,
          });
          toast.success("Sessão agendada");
        } catch (err) {
          console.error("[cal:mentor-sync]", err);
          toast.error("Agendada no Cal, mas falhou a gravar no Neuma.");
        }
        router.refresh();
      }}
    />
  );
}
