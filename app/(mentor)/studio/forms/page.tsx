import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { CreateFormDialog } from "@/components/create-form-dialog";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/labels";

export default async function FormsPage() {
  const supabase = await createClient();

  const { data: forms } = await supabase
    .from("forms")
    .select("id, title, description, is_active, is_onboarding, created_at")
    .order("created_at", { ascending: false });

  const formIds = (forms ?? []).map((f) => f.id);
  const { data: questions } =
    formIds.length > 0
      ? await supabase
          .from("form_questions")
          .select("form_id")
          .in("form_id", formIds)
      : { data: [] };
  const { data: responses } =
    formIds.length > 0
      ? await supabase
          .from("form_responses")
          .select("form_id")
          .in("form_id", formIds)
      : { data: [] };

  const qCount = new Map<string, number>();
  questions?.forEach((q) => {
    qCount.set(q.form_id, (qCount.get(q.form_id) ?? 0) + 1);
  });
  const rCount = new Map<string, number>();
  responses?.forEach((r) => {
    rCount.set(r.form_id, (rCount.get(r.form_id) ?? 0) + 1);
  });

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Studio"
        title="Formularios"
        subtitle="Diagnostico e questionarios nativos — cria, ordena perguntas e ve respostas."
      >
        <CreateFormDialog />
      </PageHero>

      {!forms || forms.length === 0 ? (
        <Card className="space-y-4 p-10 text-center">
          <ClipboardList className="mx-auto size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Ainda sem formularios</p>
            <p className="text-sm text-muted-foreground">
              Cria o diagnostico de onboarding em menos de um minuto.
            </p>
          </div>
          <div className="flex justify-center">
            <CreateFormDialog />
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {forms.map((f) => (
            <Link key={f.id} href={`/studio/forms/${f.id}`}>
              <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-card/80 sm:p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/8">
                    <ClipboardList className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{f.title}</p>
                      {f.is_onboarding ? (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-primary/15 text-primary"
                        >
                          Onboarding
                        </Badge>
                      ) : null}
                      {!f.is_active ? (
                        <Badge variant="outline">Inativo</Badge>
                      ) : null}
                    </div>
                    {f.description ? (
                      <p className="line-clamp-1 text-sm text-muted-foreground">
                        {f.description}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {qCount.get(f.id) ?? 0} perguntas ·{" "}
                      {rCount.get(f.id) ?? 0} respostas ·{" "}
                      {formatDate(f.created_at)}
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
