import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { InviteStudentForm } from "@/components/invite-student-form";
import { PageHero } from "@/components/page-hero";
import { PathStatusBadge } from "@/components/status-badges";
import { Card } from "@/components/ui/card";
import type { PathStatus } from "@/lib/types/database.types";

export default async function StudentsPage() {
  const supabase = await createClient();

  const [{ data: students }, { data: paths }, { data: pending }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, onboarding_completed, created_at")
        .eq("role", "student")
        .order("created_at", { ascending: true }),
      supabase.from("paths").select("student_id, status, title"),
      supabase
        .from("check_ins")
        .select("student_id")
        .eq("status", "pending"),
    ]);

  const pathByStudent = new Map<
    string,
    { status: PathStatus; title: string }
  >();
  paths?.forEach((p) => {
    if (!pathByStudent.has(p.student_id))
      pathByStudent.set(p.student_id, { status: p.status, title: p.title });
  });

  const pendingByStudent = new Map<string, number>();
  pending?.forEach((c) => {
    pendingByStudent.set(
      c.student_id,
      (pendingByStudent.get(c.student_id) ?? 0) + 1,
    );
  });

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Studio"
        title="Os teus alunos"
        subtitle="Abre o perfil de cada aluno para ver percurso, check-ins, forms e notas."
      >
        <InviteStudentForm />
      </PageHero>

      {!students || students.length === 0 ? (
        <Card className="space-y-4 p-10 text-center">
          <p className="font-medium">Ainda nao tens alunos</p>
          <p className="text-sm text-muted-foreground">
            Usa &quot;Convidar aluno&quot; para criar a primeira conta.
          </p>
          <div className="flex justify-center">
            <InviteStudentForm />
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {students.map((s) => {
            const path = pathByStudent.get(s.id);
            const waiting = pendingByStudent.get(s.id) ?? 0;
            const initial = (s.full_name ?? s.email ?? "?")
              .slice(0, 1)
              .toUpperCase();
            return (
              <Link key={s.id} href={`/studio/students/${s.id}`}>
                <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-card/80 sm:p-5">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--neuma-coral)]/80 to-[var(--neuma-blue)]/80 text-base font-semibold text-white">
                      {initial}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-medium">
                        {s.full_name ?? s.email}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {path ? path.title : "Sem percurso definido"}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {!s.onboarding_completed ? (
                          <span>Onboarding pendente</span>
                        ) : null}
                        {waiting > 0 ? (
                          <span className="text-[var(--neuma-coral)]">
                            {waiting} check-in{waiting > 1 ? "s" : ""} por
                            rever
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    {path ? (
                      <PathStatusBadge status={path.status} />
                    ) : null}
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
