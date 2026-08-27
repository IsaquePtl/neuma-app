"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { confirmCheckInNudges } from "@/lib/actions/mentor-agent";

async function requireMentor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "mentor") throw new Error("Sem permissão");
  return { supabase, mentorId: profile.id };
}

export async function listPendingProposals() {
  const { supabase, mentorId } = await requireMentor();
  const { data, error } = await supabase
    .from("agent_proposals")
    .select("*")
    .eq("mentor_id", mentorId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function countPendingProposals() {
  const { supabase, mentorId } = await requireMentor();
  const { count } = await supabase
    .from("agent_proposals")
    .select("id", { count: "exact", head: true })
    .eq("mentor_id", mentorId)
    .eq("status", "pending");
  return count ?? 0;
}

export async function rejectProposal(proposalId: string) {
  const { supabase, mentorId } = await requireMentor();
  const { error } = await supabase
    .from("agent_proposals")
    .update({
      status: "rejected",
      decided_at: new Date().toISOString(),
      decided_by: mentorId,
    })
    .eq("id", proposalId)
    .eq("mentor_id", mentorId);
  if (error) throw error;
  revalidatePath("/studio/agent/inbox");
  revalidatePath("/studio");
}

type PathDraftPayload = {
  title: string;
  placeholder_name?: string;
  claim_email?: string | null;
  goal?: string;
  description?: string;
  status?: string;
  brief_id?: string | null;
  nodes?: Array<{
    title: string;
    description?: string;
    kind?: string;
    order_index?: number;
    week_number?: number;
  }>;
};

export async function approveProposal(proposalId: string) {
  const { supabase, mentorId } = await requireMentor();
  const { data: proposal, error } = await supabase
    .from("agent_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("mentor_id", mentorId)
    .single();
  if (error || !proposal) throw new Error("Proposta não encontrada");
  if (proposal.status !== "pending") throw new Error("Proposta já decidida");

  const payload = (proposal.payload ?? {}) as Record<string, unknown>;
  let targetId: string | null = proposal.target_id;

  if (proposal.kind === "path_draft") {
    const p = payload as PathDraftPayload;
    const { data: path, error: pathErr } = await supabase
      .from("paths")
      .insert({
        title: p.title,
        placeholder_name: p.placeholder_name ?? null,
        claim_email: p.claim_email ?? null,
        goal: p.goal ?? null,
        description: p.description ?? null,
        status: "draft",
        student_id: null,
        created_by: mentorId,
      })
      .select("id")
      .single();
    if (pathErr || !path) throw pathErr ?? new Error("Falha ao criar percurso");
    targetId = path.id;

    const nodes = Array.isArray(p.nodes) ? p.nodes : [];
    if (nodes.length) {
      const rows = nodes
        .map((n, i) => ({
          path_id: path.id,
          title: n.title,
          description: n.description ?? null,
          kind: (["lesson", "practice", "call", "milestone"].includes(n.kind ?? "")
            ? n.kind
            : "practice") as "lesson" | "practice" | "call" | "milestone",
          order_index: n.order_index ?? i + 1,
          week_number: n.week_number ?? null,
          status: "locked" as const,
        }))
        .sort((a, b) => a.order_index - b.order_index);
      // First node stays locked until mentor activates path; draft mode.
      const { error: nodeErr } = await supabase.from("nodes").insert(rows);
      if (nodeErr) throw nodeErr;
    }

    if (p.brief_id) {
      await supabase
        .from("student_briefs")
        .update({ path_id: path.id, placeholder_name: p.placeholder_name ?? null })
        .eq("id", p.brief_id);
    }
  } else if (proposal.kind === "calendar_event") {
    const { data: ev, error: evErr } = await supabase
      .from("mentor_calendar_events")
      .insert({
        mentor_id: mentorId,
        title: String(payload.title ?? "Evento"),
        kind: (["reminder", "meeting", "event", "misc"].includes(
          String(payload.kind),
        )
          ? payload.kind
          : "meeting") as "reminder" | "meeting" | "event" | "misc",
        starts_at: String(payload.starts_at),
        ends_at: (payload.ends_at as string) ?? null,
        notes: (payload.notes as string) ?? null,
        student_id: (payload.student_id as string) ?? null,
        path_id: (payload.path_id as string) ?? null,
        node_id: (payload.node_id as string) ?? null,
        source: "agent" as const,
      })
      .select("id")
      .single();
    if (evErr) throw evErr;
    targetId = ev?.id ?? null;
  } else if (proposal.kind === "checkin_nudge") {
    const ids = (payload.student_ids as string[]) ?? [];
    await confirmCheckInNudges(ids);
  } else if (proposal.kind === "student_brief") {
    const { data: brief, error: bErr } = await supabase
      .from("student_briefs")
      .insert({
        raw_markdown: String(payload.raw_markdown ?? ""),
        placeholder_name: (payload.placeholder_name as string) ?? null,
        student_id: (payload.student_id as string) ?? null,
        structured: (payload.structured as import("@/lib/types/database.types").Json) ?? {},
        source: "agent",
        created_by: mentorId,
      })
      .select("id")
      .single();
    if (bErr) throw bErr;
    targetId = brief?.id ?? null;
  } else if (proposal.kind === "path_edit") {
    // Soft apply: mark approved; mentor edits in journey UI with payload as guide
    // Full auto-apply of arbitrary edits is intentionally limited.
  }

  const { error: upErr } = await supabase
    .from("agent_proposals")
    .update({
      status: "applied",
      decided_at: new Date().toISOString(),
      decided_by: mentorId,
      applied_at: new Date().toISOString(),
      target_id: targetId,
    })
    .eq("id", proposalId);
  if (upErr) throw upErr;

  revalidatePath("/studio/agent/inbox");
  revalidatePath("/studio/journeys");
  revalidatePath("/studio/calendar");
  revalidatePath("/studio");
  return { targetId };
}

export async function claimUnassignedPath(pathId: string, studentId: string) {
  const { supabase, mentorId } = await requireMentor();
  const { data: path, error } = await supabase
    .from("paths")
    .select("id, student_id")
    .eq("id", pathId)
    .single();
  if (error || !path) throw new Error("Percurso não encontrado");
  if (path.student_id) throw new Error("Percurso já tem aluno");

  const { error: upErr } = await supabase
    .from("paths")
    .update({
      student_id: studentId,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", pathId);
  if (upErr) throw upErr;

  await supabase
    .from("profiles")
    .update({ mentor_id: mentorId })
    .eq("id", studentId)
    .eq("role", "student");

  // Activate first node if any
  const { data: nodes } = await supabase
    .from("nodes")
    .select("id, order_index")
    .eq("path_id", pathId)
    .order("order_index");
  if (nodes?.length) {
    await supabase
      .from("nodes")
      .update({ status: "active" })
      .eq("id", nodes[0].id);
    await supabase
      .from("paths")
      .update({ status: "active" })
      .eq("id", pathId);
  }

  revalidatePath("/studio/journeys");
  revalidatePath(`/studio/students/${studentId}`);
  revalidatePath(`/studio/journeys/${pathId}`);
  revalidatePath("/session");
  revalidatePath("/home");
}
