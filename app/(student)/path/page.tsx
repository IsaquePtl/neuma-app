import Link from "next/link";
import { Target, Lock, CircleCheck, ArrowRight, Video } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NodeKindBadge } from "@/components/status-badges";
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
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: nodes } = path
    ? await supabase
        .from("nodes")
        .select("*")
        .eq("path_id", path.id)
        .order("order_index", { ascending: true })
    : { data: null };

  const active = nodes?.find((n) => n.status === "active");
  const completed = nodes?.filter((n) => n.status === "completed").length ?? 0;
  const total = nodes?.length ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (!path) {
    return (
      <div className="space-y-3 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          O teu percurso esta a nascer.
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          Depois da nossa primeira conversa, vais encontrar aqui todo o teu
          plano - passo a passo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">O meu percurso</p>
        <h1 className="text-3xl font-semibold tracking-tight">{path.title}</h1>
        {path.goal ? (
          <p className="flex items-start gap-2 text-muted-foreground">
            <Target className="mt-0.5 size-4 shrink-0" />
            {path.goal}
          </p>
        ) : null}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completed} de {total} blocos
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="neuma-gradient h-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      {/* Bloco atual em foco */}
      {active ? (
        <Card className="neuma-accent-top space-y-4 p-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-widest text-[var(--neuma-coral)]">
              A trabalhar agora
            </span>
            <NodeKindBadge kind={active.kind} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{active.title}</h2>
            {active.description ? (
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                {active.description}
              </p>
            ) : null}
          </div>
          {active.kind !== "call" ? (
            <Button
              render={<Link href={`/checkins/new?node=${active.id}`} />}
              nativeButton={false}
              className="gap-2"
            >
              <Video className="size-4" /> Fazer check-in
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este bloco e trabalhado em chamada com o mentor.
            </p>
          )}
        </Card>
      ) : (
        <Card className="p-6 text-center text-muted-foreground">
          Sem bloco ativo de momento. O mentor ira ativar o proximo em breve.
        </Card>
      )}

      {/* Timeline completa */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Todo o percurso</h2>
        <ol className="relative space-y-3 border-l pl-6">
          {nodes!.map((node, i) => {
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
                  ) : (
                    <Lock className="size-3 text-muted-foreground" />
                  )}
                </span>
                <Card
                  className={cn(
                    "p-4",
                    !isActive && !isDone && "opacity-70",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {node.week_number ? `Sem. ${node.week_number}` : `#${i + 1}`}
                    </span>
                    <p className="font-medium">{node.title}</p>
                  </div>
                  {isActive && node.description ? (
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
