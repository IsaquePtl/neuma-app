import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PathStatusBadge } from "@/components/status-badges";
import type { PathStatus } from "@/lib/types/database.types";

export default async function StudentsPage() {
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, email, onboarding_completed, created_at")
    .eq("role", "student")
    .order("created_at", { ascending: true });

  const { data: paths } = await supabase
    .from("paths")
    .select("student_id, status, title");

  const pathByStudent = new Map<string, { status: PathStatus; title: string }>();
  paths?.forEach((p) => {
    if (!pathByStudent.has(p.student_id))
      pathByStudent.set(p.student_id, { status: p.status, title: p.title });
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Alunos</p>
        <h1 className="text-3xl font-semibold tracking-tight">Os teus alunos</h1>
        <p className="text-muted-foreground">
          Entra num aluno para desenhar e acompanhar o percurso dele.
        </p>
      </header>

      {!students || students.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Ainda nao tens alunos.
        </Card>
      ) : (
        <div className="grid gap-3">
          {students.map((s) => {
            const path = pathByStudent.get(s.id);
            return (
              <Link key={s.id} href={`/studio/students/${s.id}`}>
                <Card className="flex items-center justify-between p-5 transition-colors hover:bg-card/80">
                  <div className="flex items-center gap-4">
                    <div className="grid size-11 place-items-center rounded-full bg-secondary text-base font-medium">
                      {(s.full_name ?? s.email ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{s.full_name ?? s.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {path ? path.title : "Sem percurso definido"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {path ? (
                      <PathStatusBadge status={path.status} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {s.onboarding_completed ? "" : "Onboarding pendente"}
                      </span>
                    )}
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
