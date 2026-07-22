import Link from "next/link";
import {
  Target,
  Lock,
  CircleCheck,
  Video,
  Phone,
  ExternalLink,
  CalendarClock,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalEmbed } from "@/components/calcom-embed";
import { NodeKindBadge } from "@/components/status-badges";
import { formatDate } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default async function StudentPathPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: path } = await supabase
    .from("paths")
    .select("*")
    .eq("student_id", user!.id)
    .in("status", ["active", "draft", "paused", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Prefer active path if multiple
  const { data: activePath } = await supabase
    .from("paths")
    .select("*")
    .eq("student_id", user!.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentPath = activePath ?? path;

  const { data: nodes } = currentPath
    ? await supabase
        .from("nodes")
        .select("*")
        .eq("path_id", currentPath.id)
        .order("order_index", { ascending: true })
    : { data: null };

  const { data: mentor } = await supabase
    .from("profiles")
    .select("cal_username, full_name")
    .eq("role", "mentor")
    .limit(1)
    .maybeSingle();

  const calUser =
    mentor?.cal_username ||
    process.env.NEXT_PUBLIC_CALCOM_USERNAME ||
    "isaque-portilho-nutfa9";

  const active = nodes?.find((n) => n.status === "active");
  const completed = nodes?.filter((n) => n.status === "completed").length ?? 0;
  const total = nodes?.length ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (!currentPath) {
    return (
      <div className="space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          O teu percurso esta a nascer.
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          Depois da nossa primeira conversa, vais encontrar aqui todo o teu
          plano - passo a passo.
        </p>
        <Button render={<Link href="/checkins" />} nativeButton={false} variant="secondary">
          Ver check-ins
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <header className="neuma-accent-top space-y-3 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          O meu percurso
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {currentPath.title}
        </h1>
        {currentPath.description ? (
          <p className="text-sm text-muted-foreground">
            {currentPath.description}
          </p>
        ) : null}
        {currentPath.goal ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Target className="mt-0.5 size-4 shrink-0" />
            {currentPath.goal}
          </p>
        ) : null}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completed} de {total} blocos
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="neuma-gradient h-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      {active ? (
        <Card className="neuma-accent-top space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-widest text-[var(--neuma-coral)]">
              A trabalhar agora
            </span>
            <NodeKindBadge kind={active.kind} />
            {active.due_date ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                Ate {formatDate(active.due_date)}
              </span>
            ) : null}
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{active.title}</h2>
            {active.description ? (
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                {active.description}
              </p>
            ) : null}
          </div>

          {active.kind === "call" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Este bloco e trabalhado em chamada
                {mentor?.full_name ? ` com ${mentor.full_name}` : ""}. Agenda
                abaixo.
              </p>
              <CalEmbed calLink={calUser} />
            </div>
          ) : active.kind === "resource" ? (
            <div className="space-y-3">
              {active.resource_url ? (
                <Button
                  render={
                    <a
                      href={active.resource_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                  nativeButton={false}
                  className="gap-2"
                >
                  <ExternalLink className="size-4" /> Abrir recurso
                </Button>
              ) : null}
              <Button
                render={<Link href={`/checkins/new?node=${active.id}`} />}
                nativeButton={false}
                variant="secondary"
                className="gap-2"
              >
                <Video className="size-4" /> Confirmar que concluiste
              </Button>
            </div>
          ) : (
            <Button
              render={<Link href={`/checkins/new?node=${active.id}`} />}
              nativeButton={false}
              className="gap-2"
            >
              <Video className="size-4" /> Fazer check-in
            </Button>
          )}
        </Card>
      ) : (
        <Card className="space-y-3 p-6 text-center">
          <p className="text-muted-foreground">
            {currentPath.status === "completed"
              ? "Percurso concluido. Parabens!"
              : "Sem bloco ativo de momento. O mentor ira ativar o proximo em breve."}
          </p>
          <Button render={<Link href="/checkins" />} nativeButton={false} variant="secondary">
            Ver historico
          </Button>
        </Card>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Todo o percurso</h2>
        <ol className="relative space-y-3 border-l pl-6">
          {(nodes ?? []).map((node, i) => {
            const isActive = node.status === "active";
            const isDone = node.status === "completed";
            return (
              <li key={node.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[31px] top-1.5 grid size-5 place-items-center rounded-full border bg-background",
                    isDone && "border-emerald-500 text-emerald-400",
                    isActive && "border-transparent",
                  )}
                >
                  {isDone ? (
                    <CircleCheck className="size-4" />
                  ) : isActive ? (
                    <span className="size-2.5 rounded-full neuma-gradient" />
                  ) : node.kind === "call" ? (
                    <Phone className="size-3 text-muted-foreground" />
                  ) : (
                    <Lock className="size-3 text-muted-foreground" />
                  )}
                </span>
                <Card className={cn("p-4", !isActive && !isDone && "opacity-70")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {node.week_number ? `Sem. ${node.week_number}` : `#${i + 1}`}
                    </span>
                    <p className="font-medium">{node.title}</p>
                    <NodeKindBadge kind={node.kind} />
                  </div>
                  {node.due_date ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Data limite: {formatDate(node.due_date)}
                    </p>
                  ) : null}
                  {(isActive || isDone) && node.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {node.description}
                    </p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
