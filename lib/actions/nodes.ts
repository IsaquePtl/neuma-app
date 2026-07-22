"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { NodeKind, NodeStatus } from "@/lib/types/database.types";

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
  return supabase;
}

async function studentIdOfPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pathId: string,
) {
  const { data } = await supabase
    .from("paths")
    .select("student_id")
    .eq("id", pathId)
    .single();
  return data?.student_id;
}

export async function createNode(formData: FormData) {
  const supabase = await mentorClient();
  const pathId = formData.get("path_id") as string;

  const { data: last } = await supabase
    .from("nodes")
    .select("order_index")
    .eq("path_id", pathId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIndex = (last?.order_index ?? -1) + 1;

  // Primeiro node de um percurso comeca ativo; restantes bloqueados.
  const status: NodeStatus = nextIndex === 0 ? "active" : "locked";

  await supabase.from("nodes").insert({
    path_id: pathId,
    title: (formData.get("title") as string)?.trim() || "Novo bloco",
    description: ((formData.get("description") as string) || "").trim() || null,
    week_number: formData.get("week_number")
      ? Number(formData.get("week_number"))
      : null,
    kind: ((formData.get("kind") as NodeKind) || "practice"),
    due_date: (formData.get("due_date") as string) || null,
    resource_url: ((formData.get("resource_url") as string) || "").trim() || null,
    order_index: nextIndex,
    status,
  });

  const studentId = await studentIdOfPath(supabase, pathId);
  if (studentId) revalidatePath(`/studio/students/${studentId}`);
}

export async function updateNode(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  const pathId = formData.get("path_id") as string;

  await supabase
    .from("nodes")
    .update({
      title: (formData.get("title") as string)?.trim() || "Bloco",
      description: ((formData.get("description") as string) || "").trim() || null,
      week_number: formData.get("week_number")
        ? Number(formData.get("week_number"))
        : null,
      kind: ((formData.get("kind") as NodeKind) || "practice"),
      status: ((formData.get("status") as NodeStatus) || "locked"),
      due_date: (formData.get("due_date") as string) || null,
      resource_url: ((formData.get("resource_url") as string) || "").trim() || null,
    })
    .eq("id", id);

  const studentId = await studentIdOfPath(supabase, pathId);
  if (studentId) revalidatePath(`/studio/students/${studentId}`);
}

export async function deleteNode(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  const pathId = formData.get("path_id") as string;
  await supabase.from("nodes").delete().eq("id", id);
  const studentId = await studentIdOfPath(supabase, pathId);
  if (studentId) revalidatePath(`/studio/students/${studentId}`);
}

export async function moveNode(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  const pathId = formData.get("path_id") as string;
  const direction = formData.get("direction") as "up" | "down";

  const { data: nodes } = await supabase
    .from("nodes")
    .select("id, order_index")
    .eq("path_id", pathId)
    .order("order_index", { ascending: true });

  if (!nodes) return;
  const idx = nodes.findIndex((n) => n.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= nodes.length) return;

  const a = nodes[idx];
  const b = nodes[swapWith];

  // Troca os order_index (usa valor temporario para evitar colisao no unique)
  await supabase.from("nodes").update({ order_index: -1 }).eq("id", a.id);
  await supabase.from("nodes").update({ order_index: a.order_index }).eq("id", b.id);
  await supabase.from("nodes").update({ order_index: b.order_index }).eq("id", a.id);

  const studentId = await studentIdOfPath(supabase, pathId);
  if (studentId) revalidatePath(`/studio/students/${studentId}`);
}
