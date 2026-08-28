"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { purgeAgentShellsForPathTitles } from "@/lib/actions/agent-library";
import {
  addWeeksToDate,
  resolvePathSchedule,
  segmentNodeTimeline,
  weeksBetweenDates,
} from "@/lib/path-period";
import type { PathStatus } from "@/lib/types/database.types";

async function requireMentor() {
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

async function segmentPathNodes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pathId: string,
  startDate: string,
  endDate: string,
) {
  const { data: nodes } = await supabase
    .from("nodes")
    .select("id, order_index")
    .eq("path_id", pathId)
    .order("order_index", { ascending: true });

  if (!nodes?.length) return;

  const totalWeeks = weeksBetweenDates(startDate, endDate);
  const segments = segmentNodeTimeline(nodes.length, totalWeeks);

  await Promise.all(
    nodes.map((node, i) => {
      const segment = segments[i];
      const dueDate = addWeeksToDate(
        startDate,
        segment.week_number + segment.duration_weeks - 1,
      );
      return supabase
        .from("nodes")
        .update({
          week_number: segment.week_number,
          due_date: dueDate,
        })
        .eq("id", node.id);
    }),
  );
}

export async function createDraftPath(formData: FormData) {
  const { supabase, user } = await requireMentor();
  const title = (formData.get("title") as string)?.trim() || "Novo percurso";

  const { data, error } = await supabase
    .from("paths")
    .insert({
      title,
      status: "draft",
      student_id: null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Falha ao criar percurso");

  revalidatePath("/studio/journeys");
  return data.id as string;
}

export async function upsertPath(formData: FormData) {
  const { supabase, user } = await requireMentor();

  const id = (formData.get("id") as string) || null;
  const studentId = formData.get("student_id") as string;
  const periodRaw = (formData.get("period_months") as string) || "";
  const periodMonths = periodRaw ? Number(periodRaw) : null;

  const schedule = resolvePathSchedule({
    startDate: ((formData.get("start_date") as string) || "").trim() || null,
    periodMonths: Number.isFinite(periodMonths) ? periodMonths : null,
    durationLabel:
      ((formData.get("duration_label") as string) || "").trim() || null,
    endDate: ((formData.get("end_date") as string) || "").trim() || null,
  });

  const payload = {
    student_id: studentId,
    created_by: user.id,
    title: (formData.get("title") as string)?.trim() || "Percurso",
    description: ((formData.get("description") as string) || "").trim() || null,
    goal: ((formData.get("goal") as string) || "").trim() || null,
    duration_label: schedule.durationLabel,
    start_date: schedule.startDate,
    end_date: schedule.endDate,
    status: ((formData.get("status") as PathStatus) || "draft"),
  };

  let pathId = id;

  if (id) {
    await supabase.from("paths").update(payload).eq("id", id);
  } else {
    const { data } = await supabase.from("paths").insert(payload).select("id").single();
    pathId = data?.id ?? null;
  }

  if (pathId && schedule.startDate && schedule.endDate) {
    await segmentPathNodes(supabase, pathId, schedule.startDate, schedule.endDate);
    revalidatePath(`/studio/journeys/${pathId}`);
  }

  if (studentId) {
    await supabase
      .from("profiles")
      .update({ mentor_id: user.id })
      .eq("id", studentId)
      .eq("role", "student");
  }

  revalidatePath(`/studio/students/${studentId}`);
  revalidatePath("/home");
  revalidatePath("/session");
}

export async function deletePath(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const studentId = (formData.get("student_id") as string) || "";

  const { data: nodes } = await supabase
    .from("nodes")
    .select("title")
    .eq("path_id", id);

  await supabase.from("paths").delete().eq("id", id);
  await purgeAgentShellsForPathTitles((nodes ?? []).map((n) => n.title));

  if (studentId) {
    revalidatePath(`/studio/students/${studentId}`);
  }
  revalidatePath("/studio/journeys");
  revalidatePath("/studio/agent");
  revalidatePath("/home");
  revalidatePath("/session");

  const redirectTo = (formData.get("redirect_to") as string)?.trim();
  if (redirectTo?.startsWith("/studio/")) {
    redirect(redirectTo);
  }
}

export async function setPathStatus(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const studentId = formData.get("student_id") as string;
  const status = (formData.get("status") as PathStatus) || "draft";

  await supabase.from("paths").update({ status }).eq("id", id);

  revalidatePath(`/studio/students/${studentId}`);
  revalidatePath("/home");
  revalidatePath("/session");
}
