import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { InviteStudentForm } from "@/components/invite-student-form";
import { PageHero } from "@/components/page-hero";
import { PathStatusBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";
import { Card } from "@/components/ui/card";
import type { PathStatus } from "@/lib/types/database.types";

export default async function StudentsPage() {
  const supabase = await createClient();

  const [{ data: students }, { data: paths }, { data: pending }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, onboarding_completed, created_at")
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
        subtitle="Abre cada aluno para ver percurso, check-ins e notas."
      >
        <InviteStudentForm />
      </PageHero>

      {!students || students.length === 0 ? (
        <Card className="space-y-3 p-10 text-center">
          <p className="font-medium">Ainda não tens alunos</p>
          <p className="text-sm text-muted-foreground">
            Usa o botão &quot;Convidar aluno&quot; em cima para criar a primeira
            conta.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_7rem_2rem] gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground desktop:grid">
            <span>Aluno</span>
            <span>Percurso</span>
            <span>Estado</span>
            <span />
          </div>
          <div className="divide-y divide-white/5">
            {students.map((s) => {
              const path = pathByStudent.get(s.id);
              const waiting = pendingByStudent.get(s.id) ?? 0;
              return (
                <Link
                  key={s.id}
                  href={`/studio/students/${s.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] desktop:grid desktop:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_7rem_2rem]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      name={s.full_name}
                      email={s.email}
                      avatarUrl={s.avatar_url}
                      size="lg"
                      rounded="xl"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {s.full_name ?? s.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground desktop:hidden">
                        {path ? path.title : "Sem percurso"}
                        {waiting > 0
                          ? ` · ${waiting} por rever`
                          : !s.onboarding_completed
                            ? " · onboarding pendente"
                            : ""}
                      </p>
                      {waiting > 0 ? (
                        <p className="hidden text-xs text-[var(--neuma-coral)] desktop:block">
                          {waiting} por rever
                        </p>
                      ) : !s.onboarding_completed ? (
                        <p className="hidden text-xs text-muted-foreground desktop:block">
                          Onboarding pendente
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="hidden truncate text-sm text-muted-foreground desktop:block">
                    {path ? path.title : "Sem percurso definido"}
                  </p>
                  <div className="hidden desktop:block">
                    {path ? <PathStatusBadge status={path.status} /> : null}
                  </div>
                  <ArrowRight className="size-4 shrink-0 justify-self-end text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
