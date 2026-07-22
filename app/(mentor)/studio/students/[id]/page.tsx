import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { StudentHub } from "@/components/student-hub";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: student },
    { data: path },
    { data: checkIns },
    { data: formResponses },
    { count: pendingCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, onboarding_completed, internal_notes, created_at",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("paths")
      .select("*")
      .eq("student_id", id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("check_ins")
      .select("id, status, kind, created_at, notes, node:nodes(title)")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("form_responses")
      .select(
        "id, answers, created_at, form:forms(title, is_onboarding), form_id",
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("student_id", id)
      .eq("status", "pending"),
  ]);

  if (!student) notFound();

  const { data: nodes } = path
    ? await supabase
        .from("nodes")
        .select("*")
        .eq("path_id", path.id)
        .order("order_index", { ascending: true })
    : { data: null };

  const formIds = [
    ...new Set((formResponses ?? []).map((r) => r.form_id).filter(Boolean)),
  ];
  const { data: questions } =
    formIds.length > 0
      ? await supabase
          .from("form_questions")
          .select("id, form_id, label, order_index")
          .in("form_id", formIds)
          .order("order_index", { ascending: true })
      : { data: [] };

  const questionsByForm = new Map<string, { id: string; label: string }[]>();
  questions?.forEach((q) => {
    const list = questionsByForm.get(q.form_id) ?? [];
    list.push({ id: q.id, label: q.label });
    questionsByForm.set(q.form_id, list);
  });

  const formBlocks = (formResponses ?? []).map((r) => {
    const form = Array.isArray(r.form) ? r.form[0] : r.form;
    const qs = questionsByForm.get(r.form_id) ?? [];
    const answers =
      r.answers && typeof r.answers === "object" && !Array.isArray(r.answers)
        ? (r.answers as Record<string, string | string[]>)
        : {};
    return {
      id: r.id,
      form_title: form?.title ?? "Formulario",
      is_onboarding: Boolean(form?.is_onboarding),
      created_at: r.created_at,
      pairs: qs.map((q) => {
        const val = answers[q.id];
        return {
          label: q.label,
          value: Array.isArray(val) ? val.join(", ") : (val ?? "—"),
        };
      }),
    };
  });

  return (
    <StudentHub
      student={{
        id: student.id,
        full_name: student.full_name,
        email: student.email,
        onboarding_completed: student.onboarding_completed,
        internal_notes: student.internal_notes,
        created_at: student.created_at,
      }}
      path={
        path
          ? {
              id: path.id,
              title: path.title,
              description: path.description,
              goal: path.goal,
              duration_label: path.duration_label,
              start_date: path.start_date,
              end_date: path.end_date,
              status: path.status,
            }
          : null
      }
      nodes={(nodes ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        description: n.description,
        week_number: n.week_number,
        kind: n.kind,
        status: n.status,
        due_date: n.due_date,
        resource_url: n.resource_url,
        order_index: n.order_index,
      }))}
      checkIns={(checkIns ?? []).map((c) => {
        const node = Array.isArray(c.node) ? c.node[0] : c.node;
        return {
          id: c.id,
          status: c.status,
          kind: c.kind,
          created_at: c.created_at,
          notes: c.notes,
          node_title: node?.title ?? null,
        };
      })}
      formBlocks={formBlocks}
      pendingCount={pendingCount ?? 0}
    />
  );
}
