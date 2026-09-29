"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  parseCheckInKind,
  parsePassRule,
  parsePassScore,
} from "@/lib/nodes/pass-rule";
import {
  segmentNodeTimeline,
  weekFridayForPath,
  weeksBetweenDates,
} from "@/lib/path-period";
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

function revalidateJourneyPath(pathId: string) {
  revalidatePath(`/studio/journeys/${pathId}`);
  revalidatePath(`/studio/journeys/${pathId}/edit`);
  revalidatePath("/studio/journeys");
}

function parseDurationWeeks(formData: FormData): number {
  const raw = Number(formData.get("duration_weeks") ?? 1);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(Math.floor(raw), 52);
}

/** Recompute week_number + due_date (Friday) from path start and each level's weeks. */
async function resegmentPathLevels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pathId: string,
) {
  const { data: path } = await supabase
    .from("paths")
    .select("start_date, end_date")
    .eq("id", pathId)
    .single();

  const { data: nodes } = await supabase
    .from("nodes")
    .select("id, order_index, duration_weeks")
    .eq("path_id", pathId)
    .order("order_index", { ascending: true });

  if (!nodes?.length) return;

  const startDate = path?.start_date;
  const endDate = path?.end_date;
  const totalWeeks =
    startDate && endDate ? weeksBetweenDates(startDate, endDate) : null;

  const durations = nodes.map((n) =>
    n.duration_weeks != null && n.duration_weeks >= 1 ? n.duration_weeks : 1,
  );

  const segments =
    totalWeeks != null
      ? segmentNodeTimeline(nodes.length, totalWeeks, durations)
      : (() => {
          let week = 1;
          return durations.map((duration_weeks) => {
            const seg = { week_number: week, duration_weeks };
            week += duration_weeks;
            return seg;
          });
        })();

  await Promise.all(
    nodes.map((node, i) => {
      const segment = segments[i];
      const dueDate =
        startDate != null
          ? weekFridayForPath(
              startDate,
              segment.week_number + segment.duration_weeks - 1,
            )
          : null;
      return supabase
        .from("nodes")
        .update({
          week_number: segment.week_number,
          duration_weeks: segment.duration_weeks,
          due_date: dueDate,
        })
        .eq("id", node.id);
    }),
  );
}

export async function createNode(formData: FormData) {
  const supabase = await mentorClient();
  const pathId = formData.get("path_id") as string;
  const durationWeeks = parseDurationWeeks(formData);

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

  const kind = ((formData.get("kind") as NodeKind) || "practice");
  const passRule = parsePassRule(
    (formData.get("pass_rule") as string) || "",
    kind,
  );
  await supabase.from("nodes").insert({
    path_id: pathId,
    title: (formData.get("title") as string)?.trim() || "Novo bloco",
    description: ((formData.get("description") as string) || "").trim() || null,
    duration_weeks: durationWeeks,
    kind,
    resource_url: ((formData.get("resource_url") as string) || "").trim() || null,
    content_body:
      ((formData.get("content_body") as string) || "").trim() || null,
    pass_rule: passRule,
    pass_score: parsePassScore((formData.get("pass_score") as string) || ""),
    check_in_kind: parseCheckInKind(
      (formData.get("check_in_kind") as string) || "",
      kind,
      passRule,
    ),
    phase_key: ((formData.get("phase_key") as string) || "").trim() || null,
    node_code: ((formData.get("node_code") as string) || "").trim() || null,
    order_index: nextIndex,
    status,
  });

  await resegmentPathLevels(supabase, pathId);

  const studentId = await studentIdOfPath(supabase, pathId);
  if (studentId) {
    revalidatePath(`/studio/students/${studentId}`);
    revalidatePath("/home");
    revalidatePath("/path");
    revalidatePath("/session");
  }
  revalidateJourneyPath(pathId);
}

export async function updateNode(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  const pathId = formData.get("path_id") as string;
  const durationWeeks = parseDurationWeeks(formData);

  const kind = ((formData.get("kind") as NodeKind) || "practice");
  const passRule = parsePassRule(
    (formData.get("pass_rule") as string) || "",
    kind,
  );
  if (passRule === "quiz") {
    const { count } = await supabase
      .from("node_quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("node_id", id);
    if (!count) {
      throw new Error(
        "Adiciona pelo menos uma pergunta antes de usar o gate Quiz.",
      );
    }
  }
  await supabase
    .from("nodes")
    .update({
      title: (formData.get("title") as string)?.trim() || "Bloco",
      description: ((formData.get("description") as string) || "").trim() || null,
      duration_weeks: durationWeeks,
      kind,
      status: ((formData.get("status") as NodeStatus) || "locked"),
      resource_url: ((formData.get("resource_url") as string) || "").trim() || null,
      content_body:
        ((formData.get("content_body") as string) || "").trim() || null,
      pass_rule: passRule,
      pass_score: parsePassScore((formData.get("pass_score") as string) || ""),
      check_in_kind: parseCheckInKind(
        (formData.get("check_in_kind") as string) || "",
        kind,
        passRule,
      ),
      phase_key: ((formData.get("phase_key") as string) || "").trim() || null,
      node_code: ((formData.get("node_code") as string) || "").trim() || null,
    })
    .eq("id", id);

  await resegmentPathLevels(supabase, pathId);

  const studentId = await studentIdOfPath(supabase, pathId);
  if (studentId) {
    revalidatePath(`/studio/students/${studentId}`);
    revalidatePath("/home");
    revalidatePath("/path");
    revalidatePath("/session");
  }
  revalidateJourneyPath(pathId);
}

export async function deleteNode(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  const pathId = formData.get("path_id") as string;
  await supabase.from("nodes").delete().eq("id", id);
  await resegmentPathLevels(supabase, pathId);
  const studentId = await studentIdOfPath(supabase, pathId);
  if (studentId) {
    revalidatePath(`/studio/students/${studentId}`);
    revalidatePath("/home");
    revalidatePath("/path");
    revalidatePath("/session");
  }
  revalidateJourneyPath(pathId);
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

  await resegmentPathLevels(supabase, pathId);

  const studentId = await studentIdOfPath(supabase, pathId);
  if (studentId) {
    revalidatePath(`/studio/students/${studentId}`);
  }
  revalidateJourneyPath(pathId);
}

export async function activateNode(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  const pathId = formData.get("path_id") as string;

  const { data: nodes } = await supabase
    .from("nodes")
    .select("id, status")
    .eq("path_id", pathId);

  if (!nodes?.length) return;

  for (const n of nodes) {
    if (n.id === id) {
      await supabase.from("nodes").update({ status: "active" }).eq("id", n.id);
    } else if (n.status !== "completed") {
      await supabase.from("nodes").update({ status: "locked" }).eq("id", n.id);
    }
  }

  await supabase.from("paths").update({ status: "active" }).eq("id", pathId);

  const studentId = await studentIdOfPath(supabase, pathId);
  if (studentId) {
    revalidatePath(`/studio/students/${studentId}`);
    revalidatePath("/home");
    revalidatePath("/path");
    revalidatePath("/session");
  }
  revalidateJourneyPath(pathId);
}
