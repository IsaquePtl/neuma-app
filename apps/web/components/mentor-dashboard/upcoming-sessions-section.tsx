import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { UpcomingSession } from "@/lib/calendar/events";
import { studentProfileHref } from "@/lib/journey-path/routes";

type UpcomingSessionsSectionProps = {
  sessions: UpcomingSession[];
  returnTo: string;
  limit?: number;
  viewAllHref?: string;
};

export function UpcomingSessionsSection({
  sessions,
  returnTo,
  limit,
  viewAllHref,
}: UpcomingSessionsSectionProps) {
  const visible = limit ? sessions.slice(0, limit) : sessions;
  const hiddenCount = limit ? Math.max(0, sessions.length - limit) : 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarDays className="size-5" /> Próximas sessões
        </h2>
        {viewAllHref && sessions.length > 0 ? (
          <Link
            href={viewAllHref}
            className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
          >
            Ver calendário
          </Link>
        ) : null}
      </div>
      {visible.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Sem marcações futuras ingeridas. Quando o webhook do Cal.com receber
          bookings, aparecem aqui.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-white/5">
            {visible.map((session) => {
              const when = new Date(session.start_time).toLocaleString("pt-PT", {
                dateStyle: "medium",
                timeStyle: "short",
              });
              const who =
                session.attendee_name ?? session.attendee_email ?? "Convidado";
              const levelLine = session.levelTitle
                ? `${session.levelTitle}${session.levelTheme ? ` · ${session.levelTheme}` : ""}`
                : null;

              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{who}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {session.title ?? "Sessão"} · {when}
                    </p>
                    {levelLine ? (
                      <p className="truncate text-xs text-muted-foreground">
                        Nível: {levelLine}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {session.meet_url ? (
                      <Button
                        render={
                          <a
                            href={session.meet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                        nativeButton={false}
                        size="sm"
                        variant="ghost"
                      >
                        Meet
                      </Button>
                    ) : null}
                    {session.student_id ? (
                      <Button
                        render={
                          <Link
                            href={studentProfileHref(
                              session.student_id,
                              returnTo,
                            )}
                          />
                        }
                        nativeButton={false}
                        size="sm"
                        variant="ghost"
                      >
                        Ficha
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {hiddenCount > 0 && viewAllHref ? (
            <div className="border-t border-white/5 px-4 py-2.5 text-xs text-muted-foreground">
              +{hiddenCount} mais no{" "}
              <Link
                href={viewAllHref}
                className="font-medium text-foreground/80 hover:text-foreground"
              >
                calendário
              </Link>
            </div>
          ) : null}
        </Card>
      )}
    </section>
  );
}
