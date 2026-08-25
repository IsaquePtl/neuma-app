import Link from "next/link";
import { Target, ArrowRight, Route } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { loadMyPathWithNodes } from "@/lib/students/queries";
import { StudentPathMap } from "@/components/student-path-map";
import { Button } from "@/components/ui/button";
import { CategoryThemeIcon } from "@/components/category-theme-icon";

/**
 * Mobile/tablet: mais perto do centro (como Geral). Desktop: fluxo no topo.
 */
const PATH_VIEWPORT =
  "neuma-mobile-viewport flex flex-col justify-center gap-8 overflow-y-auto pb-5 " +
  "desktop:h-auto desktop:min-h-0 desktop:justify-start desktop:overflow-visible desktop:pb-4";

export default async function StudentPathPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { path, nodes } = await loadMyPathWithNodes(user!.id);
  const completed = nodes.filter((n) => n.status === "completed").length;
  const total = nodes.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (!path) {
    return (
      <div className={PATH_VIEWPORT}>
        <div className="shrink-0 space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Percurso
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ainda sem percurso
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            O mentor está a preparar o teu caminho. Entretanto podes agendar a
            primeira conversa.
          </p>
          <Button
            render={<Link href="/session#agenda" />}
            nativeButton={false}
            className="gap-2"
          >
            Agendar com o mentor <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={PATH_VIEWPORT}>
      {/* Cabeçalho leve — o foco é o mapa de níveis */}
      <div className="shrink-0 space-y-3">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <CategoryThemeIcon theme={null} name={path.title} size={18} />
          <Route className="size-3.5" /> Percurso
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {path.title}
        </h1>
        {path.goal ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Target className="mt-0.5 size-4 shrink-0" />
            {path.goal}
          </p>
        ) : null}
        <div className="flex items-center gap-3 pt-1">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="neuma-gradient h-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
      </div>

      {nodes.length === 0 ? (
        <p className="shrink-0 text-sm text-muted-foreground">
          Ainda sem níveis neste percurso.
        </p>
      ) : (
        <div className="min-h-0 w-full">
          <StudentPathMap nodes={nodes} />
        </div>
      )}
    </div>
  );
}
