import Link from "next/link";
import { Users, Inbox, Route, ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/page-hero";
import { CheckInStatusBadge } from "@/components/status-badges";
import { formatDateTime } from "@/lib/labels";

export default async function StudioDashboard() {
  const supabase = await createClient();

  const [{ data: students }, { data: pending }, { data: recent }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, onboarding_completed")
        .eq("role", "student")
        .order("created_at", { ascending: true }),
      supabase.from("check_ins").select("id").eq("status", "pending"),
      supabase
        .from("check_ins")
        .select("id, status, created_at, kind, student:profiles!check_ins_student_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const studentCount = students?.length ?? 0;
  const pendingCount = pending?.length ?? 0;

  const stats = [
    {
      label: "Alunos",
      value: studentCount,
      icon: Users,
      href: "/studio/students",
    },
    {
      label: "Check-ins por rever",
      value: pendingCount,
      icon: Inbox,
      href: "/studio/checkins",
    },
  ];

  return (
    <div className="space-y-10">
      <PageHero
        eyebrow="Painel do Mentor"
        title="Bom te ver por aqui."
        subtitle="Planeia percursos, revê check-ins e acompanha cada aluno num só lugar."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="flex items-center justify-between p-6 transition-all hover:-translate-y-0.5 hover:ring-white/20">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-4xl font-semibold tabular-nums">
                    {s.value}
                  </p>
                </div>
                <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--neuma-coral)]/25 to-[var(--neuma-blue)]/25 text-foreground">
                  <Icon className="size-6" />
                </span>
              </Card>
            </Link>
          );
        })}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Alunos</h2>
          <Button
            render={<Link href="/studio/students" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="gap-1"
          >
            Ver todos <ArrowRight className="size-4" />
          </Button>
        </div>

        {studentCount === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Ainda nao tens alunos. Eles aparecem aqui assim que criarem conta.
          </Card>
        ) : (
          <div className="grid gap-3">
            {students!.map((s) => (
              <Link key={s.id} href={`/studio/students/${s.id}`}>
                <Card className="flex items-center justify-between p-4 transition-colors hover:bg-card/80">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-full bg-secondary text-sm font-medium">
                      {(s.full_name ?? s.email ?? "?")
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{s.full_name ?? s.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.onboarding_completed
                          ? "Onboarding concluido"
                          : "Onboarding pendente"}
                      </p>
                    </div>
                  </div>
                  <Route className="size-4 text-muted-foreground" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Atividade recente</h2>
        {!recent || recent.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Sem check-ins ainda.
          </Card>
        ) : (
          <div className="grid gap-3">
            {recent.map((c) => {
              const student = Array.isArray(c.student)
                ? c.student[0]
                : c.student;
              return (
                <Link key={c.id} href={`/studio/checkins/${c.id}`}>
                  <Card className="flex items-center justify-between p-4 transition-colors hover:bg-card/80">
                    <div>
                      <p className="font-medium">
                        {student?.full_name ?? "Aluno"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(c.created_at)}
                      </p>
                    </div>
                    <CheckInStatusBadge status={c.status} />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
