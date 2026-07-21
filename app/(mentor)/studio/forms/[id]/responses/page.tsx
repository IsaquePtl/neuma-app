import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/labels";

export default async function FormResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id, title")
    .eq("id", id)
    .single();

  if (!form) notFound();

  const { data: questions } = await supabase
    .from("form_questions")
    .select("id, label, order_index")
    .eq("form_id", id)
    .order("order_index", { ascending: true });

  const { data: responses } = await supabase
    .from("form_responses")
    .select(
      "id, answers, created_at, student:profiles!form_responses_student_id_fkey(full_name, email)",
    )
    .eq("form_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <Link
        href={`/studio/forms/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {form.title}
      </Link>

      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Respostas</p>
        <h1 className="text-2xl font-semibold tracking-tight">{form.title}</h1>
      </header>

      {!responses || responses.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Sem respostas ainda.
        </Card>
      ) : (
        <div className="space-y-4">
          {responses.map((r) => {
            const student = Array.isArray(r.student)
              ? r.student[0]
              : r.student;
            const answers = (r.answers ?? {}) as Record<
              string,
              string | string[]
            >;
            return (
              <Card key={r.id} className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {student?.full_name ?? student?.email ?? "Aluno"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(r.created_at)}
                  </p>
                </div>
                <dl className="space-y-3">
                  {questions?.map((q) => {
                    const a = answers[q.id];
                    return (
                      <div key={q.id}>
                        <dt className="text-sm text-muted-foreground">
                          {q.label}
                        </dt>
                        <dd className="text-sm">
                          {a
                            ? Array.isArray(a)
                              ? a.join(", ")
                              : a
                            : "-"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
