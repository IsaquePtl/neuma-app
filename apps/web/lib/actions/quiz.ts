"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database.types";

export type QuizOption = { id: string; label: string };

export type QuizQuestionInput = {
  id?: string;
  prompt: string;
  options: QuizOption[];
  correct_option_id: string;
};

export type QuizQuestion = {
  id: string;
  node_id: string;
  order_index: number;
  prompt: string;
  options: QuizOption[];
  correct_option_id: string;
};

export type QuizAttemptSummary = {
  id: string;
  score: number;
  correct_count: number;
  total: number;
  created_at: string;
};

function parseOptions(raw: Json): QuizOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const id = "id" in item ? String(item.id ?? "") : "";
      const label = "label" in item ? String(item.label ?? "") : "";
      if (!id || !label.trim()) return null;
      return { id, label: label.trim() };
    })
    .filter((o): o is QuizOption => Boolean(o));
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");
  return { supabase, user };
}

async function requireMentor() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "mentor") throw new Error("Sem permissao");
  return { supabase, user };
}

async function revalidateNodePaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nodeId: string,
) {
  const { data: node } = await supabase
    .from("nodes")
    .select("path_id")
    .eq("id", nodeId)
    .maybeSingle();
  if (!node) return;
  const { data: path } = await supabase
    .from("paths")
    .select("student_id")
    .eq("id", node.path_id)
    .maybeSingle();
  revalidatePath(`/studio/journeys/${node.path_id}`);
  revalidatePath(`/path/${nodeId}`);
  if (path?.student_id) {
    revalidatePath(`/studio/students/${path.student_id}`);
    revalidatePath("/home");
    revalidatePath("/path");
  }
}

export async function listQuizQuestions(
  nodeId: string,
): Promise<QuizQuestion[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("node_quiz_questions")
    .select("id, node_id, order_index, prompt, options, correct_option_id")
    .eq("node_id", nodeId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    node_id: row.node_id,
    order_index: row.order_index,
    prompt: row.prompt,
    options: parseOptions(row.options),
    correct_option_id: row.correct_option_id,
  }));
}

export async function saveQuizQuestions(
  nodeId: string,
  questions: QuizQuestionInput[],
) {
  const { supabase } = await requireMentor();

  const cleaned = questions
    .map((q, index) => {
      const options = (q.options ?? [])
        .map((o) => ({
          id: (o.id || "").trim() || crypto.randomUUID(),
          label: (o.label || "").trim(),
        }))
        .filter((o) => o.label.length > 0);
      const prompt = (q.prompt || "").trim();
      if (!prompt || options.length < 2) return null;
      const correct =
        options.find((o) => o.id === q.correct_option_id)?.id ?? options[0].id;
      return {
        id: q.id,
        node_id: nodeId,
        order_index: index,
        prompt,
        options,
        correct_option_id: correct,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((q): q is NonNullable<typeof q> => Boolean(q));

  const { data: existing } = await supabase
    .from("node_quiz_questions")
    .select("id")
    .eq("node_id", nodeId);
  const existingIds = new Set((existing ?? []).map((r) => r.id));
  const keepIds = new Set(
    cleaned.map((q) => q.id).filter((id): id is string => Boolean(id)),
  );
  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
  if (toDelete.length) {
    await supabase.from("node_quiz_questions").delete().in("id", toDelete);
  }

  for (const q of cleaned) {
    const payload = {
      node_id: q.node_id,
      order_index: q.order_index,
      prompt: q.prompt,
      options: q.options as unknown as Json,
      correct_option_id: q.correct_option_id,
      updated_at: q.updated_at,
    };
    if (q.id && existingIds.has(q.id)) {
      const { error } = await supabase
        .from("node_quiz_questions")
        .update(payload)
        .eq("id", q.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("node_quiz_questions").insert(payload);
      if (error) throw new Error(error.message);
    }
  }

  await revalidateNodePaths(supabase, nodeId);
}

export async function listQuizAttempts(
  nodeId: string,
): Promise<QuizAttemptSummary[]> {
  const { supabase } = await requireMentor();
  const { data, error } = await supabase
    .from("node_quiz_attempts")
    .select("id, score, correct_count, total, created_at")
    .eq("node_id", nodeId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listMyQuizAttempts(
  nodeId: string,
): Promise<QuizAttemptSummary[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("node_quiz_attempts")
    .select("id, score, correct_count, total, created_at")
    .eq("node_id", nodeId)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Student-facing: questions without correct answers exposed in the return type used by UI — still returns correct_option_id for client scoring; scoring is also verified server-side. */
export async function getQuizForStudent(nodeId: string): Promise<{
  questions: Omit<QuizQuestion, "correct_option_id">[];
}> {
  const questions = await listQuizQuestions(nodeId);
  return {
    questions: questions.map(({ correct_option_id: _, ...rest }) => rest),
  };
}

export async function submitQuizAttempt(
  nodeId: string,
  answers: Record<string, string>,
): Promise<QuizAttemptSummary> {
  const { supabase, user } = await requireUser();
  const questions = await listQuizQuestions(nodeId);
  if (questions.length === 0) {
    throw new Error("Este check-point ainda nao tem perguntas");
  }

  let correctCount = 0;
  for (const q of questions) {
    if (answers[q.id] && answers[q.id] === q.correct_option_id) {
      correctCount += 1;
    }
  }
  const total = questions.length;
  const score = Math.round((correctCount / total) * 100);

  const { data, error } = await supabase
    .from("node_quiz_attempts")
    .insert({
      node_id: nodeId,
      student_id: user.id,
      answers: answers as unknown as Json,
      score,
      correct_count: correctCount,
      total,
    })
    .select("id, score, correct_count, total, created_at")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/path/${nodeId}`);
  revalidatePath("/home");
  revalidatePath("/path");

  return data;
}
