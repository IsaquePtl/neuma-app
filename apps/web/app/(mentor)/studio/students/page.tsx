import { createClient } from "@/lib/supabase/server";
import { FlashToast } from "@/components/flash-toast";
import { PageHero } from "@/components/page-hero";
import { StudentsList } from "@/components/students-list";
import { Card } from "@/components/ui/card";
import type { PathStatus } from "@/lib/types/database.types";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ removed?: string }>;
}) {
  const { removed } = await searchParams;
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
    if (!p.student_id) return;
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

  const studentRows =
    students?.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      email: s.email,
      avatar_url: s.avatar_url,
      onboarding_completed: s.onboarding_completed,
      path: pathByStudent.get(s.id) ?? null,
      pendingCount: pendingByStudent.get(s.id) ?? 0,
    })) ?? [];

  return (
    <div className="space-y-6">
      {removed === "1" ? (
        <FlashToast message="Aluno removido com sucesso." />
      ) : null}
      <PageHero
        eyebrow="Studio"
        title="Os teus alunos"
        subtitle="Abre cada aluno para ver percurso, check-ins e notas."
      />

      {studentRows.length === 0 ? (
        <Card className="space-y-3 p-10 text-center">
          <p className="font-medium">Ainda não tens alunos</p>
          <p className="text-sm text-muted-foreground">
            Os alunos aparecem aqui quando tiverem conta na plataforma.
          </p>
        </Card>
      ) : (
        <StudentsList students={studentRows} />
      )}
    </div>
  );
}
