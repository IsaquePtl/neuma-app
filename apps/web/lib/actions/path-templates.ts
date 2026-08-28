"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  addWeeksToDate,
  resolvePathSchedule,
  segmentNodeTimeline,
  weeksBetweenDates,
} from "@/lib/path-period";
import type {
  NodeKind,
  PathStatus,
  PathTemplateStatus,
} from "@/lib/types/database.types";

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

async function segmentTemplateNodes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
  startDate: string,
  endDate: string,
) {
  const { data: nodes } = await supabase
    .from("path_template_nodes")
    .select("id, order_index, duration_weeks")
    .eq("template_id", templateId)
    .order("order_index", { ascending: true });

  if (!nodes?.length) return;

  const totalWeeks = weeksBetweenDates(startDate, endDate);
  const segments = segmentNodeTimeline(
    nodes.length,
    totalWeeks,
    nodes.map((node) => node.duration_weeks),
  );

  await Promise.all(
    nodes.map((node, i) => {
      const segment = segments[i];
      return supabase
        .from("path_template_nodes")
        .update({
          week_number: segment.week_number,
          duration_weeks: segment.duration_weeks,
        })
        .eq("id", node.id);
    }),
  );
}

export async function upsertPathTemplate(formData: FormData) {
  const { supabase, user } = await requireMentor();
  const id = (formData.get("id") as string) || null;
  const now = new Date().toISOString();

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
    title: (formData.get("title") as string)?.trim() || "Template",
    description: ((formData.get("description") as string) || "").trim() || null,
    goal: ((formData.get("goal") as string) || "").trim() || null,
    duration_label: schedule.durationLabel,
    suggested_node_count: formData.get("suggested_node_count")
      ? Number(formData.get("suggested_node_count"))
      : null,
    status: ((formData.get("status") as PathTemplateStatus) || "draft"),
    start_date: schedule.startDate,
    end_date: schedule.endDate,
    period_months: schedule.periodMonths,
    updated_at: now,
  };

  let templateId = id;

  if (id) {
    const { error } = await supabase
      .from("path_templates")
      .update(payload)
      .eq("id", id);
    if (error) throw new Error(error.message);
    templateId = id;
    revalidatePath(`/studio/library/templates/${id}`);
  } else {
    const { data, error } = await supabase
      .from("path_templates")
      .insert({ ...payload, created_by: user.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    templateId = data.id;
    revalidatePath("/studio/library");
    revalidatePath("/studio/journeys");
  }

  if (templateId && schedule.startDate && schedule.endDate) {
    await segmentTemplateNodes(
      supabase,
      templateId,
      schedule.startDate,
      schedule.endDate,
    );
    revalidatePath(`/studio/library/templates/${templateId}`);
  }

  revalidatePath("/studio/library");
  revalidatePath("/studio/journeys");
  return templateId;
}

export async function deletePathTemplate(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  // Soft-delete: keeps source_template_id history on applied paths.
  const { error } = await supabase
    .from("path_templates")
    .update({
      status: "archived" satisfies PathTemplateStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/studio/library");
  revalidatePath("/studio/journeys");

  const redirectTo = (formData.get("redirect_to") as string)?.trim();
  if (redirectTo?.startsWith("/studio/")) {
    redirect(redirectTo);
  }
  if (formData.get("redirect") !== "0") {
    redirect("/studio/library");
  }
}

/** Copia um percurso existente para a lista de templates. */
export async function savePathAsTemplate(formData: FormData) {
  const { supabase, user } = await requireMentor();
  const pathId = (formData.get("path_id") as string)?.trim();
  if (!pathId) throw new Error("Percurso em falta");

  const [{ data: path, error: pathErr }, { data: nodes, error: nodesErr }] =
    await Promise.all([
      supabase
        .from("paths")
        .select(
          "id, title, description, goal, duration_label, start_date, end_date",
        )
        .eq("id", pathId)
        .maybeSingle(),
      supabase
        .from("nodes")
        .select(
          "title, description, kind, week_number, order_index, resource_url",
        )
        .eq("path_id", pathId)
        .order("order_index", { ascending: true }),
    ]);

  if (pathErr || !path) throw new Error(pathErr?.message ?? "Percurso não encontrado");
  if (nodesErr) throw new Error(nodesErr.message);

  const now = new Date().toISOString();
  const { data: template, error: templateErr } = await supabase
    .from("path_templates")
    .insert({
      title: path.title,
      description: path.description,
      goal: path.goal,
      duration_label: path.duration_label,
      start_date: path.start_date,
      end_date: path.end_date,
      suggested_node_count: nodes?.length ?? null,
      status: "draft",
      created_by: user.id,
      updated_at: now,
    })
    .select("id")
    .single();

  if (templateErr || !template) {
    throw new Error(templateErr?.message ?? "Falha ao criar template");
  }

  if (nodes?.length) {
    const rows = nodes.map((n, i) => ({
      template_id: template.id,
      title: n.title,
      description: n.description,
      kind: n.kind,
      week_number: n.week_number,
      order_index: n.order_index ?? i,
      default_resource_url: n.resource_url,
    }));
    const { error: insertErr } = await supabase
      .from("path_template_nodes")
      .insert(rows);
    if (insertErr) throw new Error(insertErr.message);
  }

  revalidatePath("/studio/journeys");
  revalidatePath("/studio/library");
  return template.id as string;
}

export async function setPathTemplateStatus(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const status = (formData.get("status") as PathTemplateStatus) || "draft";
  const { error } = await supabase
    .from("path_templates")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/studio/library");
  revalidatePath("/studio/journeys");
  revalidatePath(`/studio/library/templates/${id}`);
}

export async function upsertTemplateNode(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = (formData.get("id") as string) || null;
  const templateId = formData.get("template_id") as string;

  const payload = {
    title: (formData.get("title") as string)?.trim() || "Nível",
    description: ((formData.get("description") as string) || "").trim() || null,
    kind: ((formData.get("kind") as NodeKind) || "practice"),
    week_number: formData.get("week_number")
      ? Number(formData.get("week_number"))
      : null,
    duration_weeks: formData.get("duration_weeks")
      ? Number(formData.get("duration_weeks"))
      : null,
    default_resource_url:
      ((formData.get("default_resource_url") as string) || "").trim() || null,
    library_asset_id:
      ((formData.get("library_asset_id") as string) || "").trim() || null,
  };

  if (id) {
    const { error } = await supabase
      .from("path_template_nodes")
      .update(payload)
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data: last } = await supabase
      .from("path_template_nodes")
      .select("order_index")
      .eq("template_id", templateId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("path_template_nodes").insert({
      ...payload,
      template_id: templateId,
      order_index: (last?.order_index ?? -1) + 1,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/studio/library/templates/${templateId}`);
  revalidatePath("/studio/library");
  revalidatePath("/studio/journeys");
}

export async function deleteTemplateNode(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const templateId = formData.get("template_id") as string;
  const { error } = await supabase
    .from("path_template_nodes")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/studio/library/templates/${templateId}`);
  revalidatePath("/studio/library");
  revalidatePath("/studio/journeys");
}

export async function moveTemplateNode(formData: FormData) {
  const { supabase } = await requireMentor();
  const id = formData.get("id") as string;
  const templateId = formData.get("template_id") as string;
  const direction = formData.get("direction") as "up" | "down";

  const { data: nodes } = await supabase
    .from("path_template_nodes")
    .select("id, order_index")
    .eq("template_id", templateId)
    .order("order_index", { ascending: true });

  if (!nodes) return;
  const idx = nodes.findIndex((n) => n.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= nodes.length) return;

  const a = nodes[idx];
  const b = nodes[swapWith];

  await supabase
    .from("path_template_nodes")
    .update({ order_index: -1 })
    .eq("id", a.id);
  await supabase
    .from("path_template_nodes")
    .update({ order_index: a.order_index })
    .eq("id", b.id);
  await supabase
    .from("path_template_nodes")
    .update({ order_index: b.order_index })
    .eq("id", a.id);

  revalidatePath(`/studio/library/templates/${templateId}`);
  revalidatePath("/studio/library");
  revalidatePath("/studio/journeys");
}

/** Copy template → student path instance (detached). */
export async function applyPathTemplate(formData: FormData) {
  const { supabase, user } = await requireMentor();
  const studentId = formData.get("student_id") as string;
  const templateId = formData.get("template_id") as string;
  const status = ((formData.get("status") as PathStatus) || "draft");

  const { data: template, error: tErr } = await supabase
    .from("path_templates")
    .select(
      "id, title, description, goal, duration_label, period_months, start_date, end_date, path_template_nodes(id, order_index, title, description, kind, week_number, duration_weeks, default_resource_url, library_asset_id, library_assets(url, body))",
    )
    .eq("id", templateId)
    .single();

  if (tErr || !template) throw new Error(tErr?.message ?? "Template not found");

  const title =
    ((formData.get("title") as string) || "").trim() || template.title;
  const description =
    ((formData.get("description") as string) || "").trim() ||
    template.description;
  const goal =
    ((formData.get("goal") as string) || "").trim() || template.goal;

  const periodRaw = (formData.get("period_months") as string) || "";
  const periodMonths = periodRaw
    ? Number(periodRaw)
    : template.period_months;
  const schedule = resolvePathSchedule({
    startDate:
      ((formData.get("start_date") as string) || "").trim() ||
      template.start_date,
    periodMonths: Number.isFinite(periodMonths) ? periodMonths : null,
    durationLabel:
      ((formData.get("duration_label") as string) || "").trim() ||
      template.duration_label,
    endDate:
      ((formData.get("end_date") as string) || "").trim() || template.end_date,
  });

  const { data: path, error: pErr } = await supabase
    .from("paths")
    .insert({
      student_id: studentId,
      created_by: user.id,
      title,
      description,
      goal,
      duration_label: schedule.durationLabel,
      start_date: schedule.startDate,
      end_date: schedule.endDate,
      status,
      source_template_id: template.id,
    })
    .select("id")
    .single();

  if (pErr || !path) throw new Error(pErr?.message ?? "Failed to create path");

  await supabase
    .from("profiles")
    .update({ mentor_id: user.id })
    .eq("id", studentId)
    .eq("role", "student");

  const rawNodes = Array.isArray(template.path_template_nodes)
    ? [...template.path_template_nodes].sort(
        (a, b) => a.order_index - b.order_index,
      )
    : [];

  if (rawNodes.length > 0) {
    let segments: ReturnType<typeof segmentNodeTimeline> | null = null;
    if (schedule.startDate && schedule.endDate) {
      const totalWeeks = weeksBetweenDates(
        schedule.startDate,
        schedule.endDate,
      );
      segments = segmentNodeTimeline(
        rawNodes.length,
        totalWeeks,
        rawNodes.map((n) => n.duration_weeks),
      );
    }

    const rows = rawNodes.map((n, i) => {
      const asset = Array.isArray(n.library_assets)
        ? n.library_assets[0]
        : n.library_assets;
      const status: "active" | "locked" = i === 0 ? "active" : "locked";
      const segment = segments?.[i];
      const week_number = segment?.week_number ?? n.week_number;
      const due_date =
        schedule.startDate && segment
          ? addWeeksToDate(
              schedule.startDate,
              segment.week_number + segment.duration_weeks - 1,
            )
          : null;
      return {
        path_id: path.id,
        title: n.title,
        description: n.description,
        kind: n.kind,
        week_number,
        due_date,
        order_index: i,
        status,
        resource_url: asset?.url ?? n.default_resource_url ?? null,
        content_body: asset?.body ?? null,
      };
    });

    const { error: nErr } = await supabase.from("nodes").insert(rows);
    if (nErr) throw new Error(nErr.message);
  }

  revalidatePath(`/studio/students/${studentId}`);
  revalidatePath("/studio/students");
  revalidatePath("/home");
  revalidatePath("/session");
  revalidatePath("/studio/library");
  revalidatePath("/studio/journeys");
}
