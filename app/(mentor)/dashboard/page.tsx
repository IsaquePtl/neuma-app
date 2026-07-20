import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, email, onboarding_completed")
    .eq("role", "student")
    .order("created_at", { ascending: true });

  const { count: pendingCheckIns } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visao geral</h1>
        <p className="text-sm text-muted-foreground">
          Os teus alunos e check-ins por rever.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alunos ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{students?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Check-ins por rever
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{pendingCheckIns ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Alunos</h2>
        {students && students.length > 0 ? (
          <div className="divide-y rounded-lg border">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {student.full_name ?? student.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {student.email}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {student.onboarding_completed
                    ? "Onboarding completo"
                    : "Por fazer onboarding"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ainda nao ha alunos. Convida os teus primeiros 4 mentorandos.
          </p>
        )}
      </div>
    </div>
  );
}
