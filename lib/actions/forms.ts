"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { FormQuestionType, Json } from "@/lib/types/database.types";

async function mentorClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") throw new Error("Sem permissao");
  return { supabase, user };
}

export async function createForm(formData: FormData) {
  const { supabase, user } = await mentorClient();
  const { data } = await supabase
    .from("forms")
    .insert({
      created_by: user.id,
      title: (formData.get("title") as string)?.trim() || "Novo formulario",
      description: ((formData.get("description") as string) || "").trim() || null,
      is_onboarding: formData.get("is_onboarding") === "on",
      is_active: true,
    })
    .select("id")
    .single();

  revalidatePath("/studio/forms");
  if (data?.id) redirect(`/studio/forms/${data.id}`);
}

export async function updateForm(formData: FormData) {
  const { supabase } = await mentorClient();
  const id = formData.get("id") as string;
  await supabase
    .from("forms")
    .update({
      title: (formData.get("title") as string)?.trim() || "Formulario",
      description: ((formData.get("description") as string) || "").trim() || null,
      is_active: formData.get("is_active") === "on",
      is_onboarding: formData.get("is_onboarding") === "on",
    })
    .eq("id", id);
  revalidatePath(`/studio/forms/${id}`);
  revalidatePath("/studio/forms");
}

export async function addQuestion(formData: FormData) {
  const { supabase } = await mentorClient();
  const formId = formData.get("form_id") as string;

  const { data: last } = await supabase
    .from("form_questions")
    .select("order_index")
    .eq("form_id", formId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const type = (formData.get("type") as FormQuestionType) || "short_text";
  const rawOptions = ((formData.get("options") as string) || "").trim();
  const options: Json | null =
    (type === "single_choice" || type === "multi_choice") && rawOptions
      ? rawOptions
          .split("\n")
          .map((o) => o.trim())
          .filter(Boolean)
      : null;

  await supabase.from("form_questions").insert({
    form_id: formId,
    order_index: (last?.order_index ?? -1) + 1,
    label: (formData.get("label") as string)?.trim() || "Pergunta",
    help_text: ((formData.get("help_text") as string) || "").trim() || null,
    type,
    options,
    required: formData.get("required") === "on",
  });

  revalidatePath(`/studio/forms/${formId}`);
}

export async function deleteQuestion(formData: FormData) {
  const { supabase } = await mentorClient();
  const id = formData.get("id") as string;
  const formId = formData.get("form_id") as string;
  await supabase.from("form_questions").delete().eq("id", id);
  revalidatePath(`/studio/forms/${formId}`);
}

export async function moveQuestion(formData: FormData) {
  const { supabase } = await mentorClient();
  const id = formData.get("id") as string;
  const formId = formData.get("form_id") as string;
  const direction = formData.get("direction") as "up" | "down";

  const { data: questions } = await supabase
    .from("form_questions")
    .select("id, order_index")
    .eq("form_id", formId)
    .order("order_index", { ascending: true });

  if (!questions?.length) return;

  const index = questions.findIndex((q) => q.id === id);
  if (index < 0) return;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= questions.length) return;

  const a = questions[index];
  const b = questions[swapWith];

  await Promise.all([
    supabase
      .from("form_questions")
      .update({ order_index: b.order_index })
      .eq("id", a.id),
    supabase
      .from("form_questions")
      .update({ order_index: a.order_index })
      .eq("id", b.id),
  ]);

  revalidatePath(`/studio/forms/${formId}`);
}

export async function updateQuestion(formData: FormData) {
  const { supabase } = await mentorClient();
  const id = formData.get("id") as string;
  const formId = formData.get("form_id") as string;
  const type = (formData.get("type") as FormQuestionType) || "short_text";
  const rawOptions = ((formData.get("options") as string) || "").trim();
  const options: Json | null =
    (type === "single_choice" || type === "multi_choice") && rawOptions
      ? rawOptions
          .split("\n")
          .map((o) => o.trim())
          .filter(Boolean)
      : null;

  await supabase
    .from("form_questions")
    .update({
      label: (formData.get("label") as string)?.trim() || "Pergunta",
      help_text: ((formData.get("help_text") as string) || "").trim() || null,
      type,
      options,
      required: formData.get("required") === "on",
    })
    .eq("id", id);

  revalidatePath(`/studio/forms/${formId}`);
}

export async function deleteForm(formData: FormData) {
  const { supabase } = await mentorClient();
  const id = formData.get("id") as string;
  await supabase.from("forms").delete().eq("id", id);
  revalidatePath("/studio/forms");
  redirect("/studio/forms");
}

export async function submitFormResponse(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");

  const formId = formData.get("form_id") as string;
  const redirectTo = (formData.get("redirect_to") as string) || "/path";

  // recolhe respostas: campos com prefixo q_<questionId>
  const answers: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("q_")) continue;
    const qid = key.slice(2);
    const v = String(value);
    if (answers[qid]) {
      const cur = answers[qid];
      answers[qid] = Array.isArray(cur) ? [...cur, v] : [cur as string, v];
    } else {
      answers[qid] = v;
    }
  }

  await supabase.from("form_responses").insert({
    form_id: formId,
    student_id: user.id,
    answers,
  });

  revalidatePath(redirectTo);
  redirect(redirectTo);
}
