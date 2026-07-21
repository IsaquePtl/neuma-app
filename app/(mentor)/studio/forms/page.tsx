import Link from "next/link";
import { ClipboardList, ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createForm } from "@/lib/actions/forms";

export default async function FormsPage() {
  const supabase = await createClient();

  const { data: forms } = await supabase
    .from("forms")
    .select("id, title, description, is_active, is_onboarding, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Formularios</p>
        <h1 className="text-3xl font-semibold tracking-tight">Formularios</h1>
        <p className="text-muted-foreground">
          Cria questionarios de diagnostico e recolhe respostas dos alunos.
        </p>
      </header>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Novo formulario</h2>
        <form action={createForm} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titulo</Label>
            <Input
              id="title"
              name="title"
              placeholder="Ex: Diagnostico inicial"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descricao</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Contexto que o aluno ve antes de responder..."
            />
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="is_onboarding"
              className="size-4 accent-[var(--neuma-coral)]"
            />
            Usar como formulario de onboarding
          </label>
          <Button type="submit">Criar formulario</Button>
        </form>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Os teus formularios{" "}
          <span className="text-muted-foreground">({forms?.length ?? 0})</span>
        </h2>
        {!forms || forms.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Ainda nao criaste formularios.
          </Card>
        ) : (
          <div className="grid gap-3">
            {forms.map((f) => (
              <Link key={f.id} href={`/studio/forms/${f.id}`}>
                <Card className="flex items-center justify-between p-5 transition-colors hover:bg-card/80">
                  <div className="flex items-start gap-3">
                    <ClipboardList className="mt-0.5 size-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{f.title}</p>
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
                        <p className="text-sm text-muted-foreground">
                          {f.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
