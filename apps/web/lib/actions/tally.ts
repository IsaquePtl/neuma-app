"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generateCheckInDraft } from "@/lib/ai/draft-feedback";

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

function revalidateSubmission(id: string, studentId?: string | null) {
  revalidatePath("/studio");
  revalidatePath("/studio/journeys");
  revalidatePath("/studio/journeys/checkins");
  revalidatePath("/studio/journeys/onboardings");
  revalidatePath("/studio/intake");
  revalidatePath(`/studio/intake/${id}`);
  if (studentId) revalidatePath(`/studio/students/${studentId}`);
}

export type LinkTallyResult = {
  studentId: string;
  checkInId: string | null;
  needsActiveNode: boolean;
  submissionKind: string;
};

export async function markTallySubmissionProcessed(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Submissao invalida");

  const { data: submission } = await supabase
    .from("tally_submissions")
    .select("id, student_id, submission_kind")
    .eq("id", id)
    .maybeSingle();

  await supabase
    .from("tally_submissions")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("id", id);

  if (
    submission?.submission_kind === "onboarding" &&
    submission.student_id
  ) {
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", submission.student_id)
      .eq("role", "student");
  }

  revalidateSubmission(id, submission?.student_id);
  if (submission?.student_id) {
    revalidatePath(`/studio/students/${submission.student_id}`);
    revalidatePath("/home");
  }
}

export async function markTallySubmissionPending(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Submissao invalida");

  await supabase
    .from("tally_submissions")
    .update({ status: "pending", processed_at: null })
    .eq("id", id);

  revalidateSubmission(id);
}

export async function linkTallySubmissionToStudent(
  formData: FormData,
): Promise<LinkTallyResult> {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  const studentId = formData.get("student_id") as string;
  if (!id || !studentId) throw new Error("Dados invalidos");

  const { data: student } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle();

  if (!student) throw new Error("Aluno nao encontrado");

  const { data: submission } = await supabase
    .from("tally_submissions")
    .select(
      "id, submission_kind, node_id, check_in_id, notes, video_url, student_id",
    )
    .eq("id", id)
    .single();

  if (!submission) throw new Error("Submissao nao encontrada");

  let checkInId = submission.check_in_id;
  let needsActiveNode = false;

  // Check-in órfão: criar check_ins para entrar na fila Avaliar
  if (
    submission.submission_kind === "checkin" &&
    !submission.check_in_id
  ) {
    let nodeId = submission.node_id;

    if (!nodeId) {
      const { data: activePath } = await supabase
        .from("paths")
        .select("id")
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activePath) {
        const { data: activeNode } = await supabase
          .from("nodes")
          .select("id")
          .eq("path_id", activePath.id)
          .eq("status", "active")
          .maybeSingle();
        nodeId = activeNode?.id ?? null;
      }
    }

    if (nodeId) {
      const { data: checkIn, error: checkInError } = await supabase
        .from("check_ins")
        .insert({
          node_id: nodeId,
          student_id: studentId,
          kind: submission.video_url ? "video" : "text",
          video_url: submission.video_url,
          notes: submission.notes,
          status: "pending",
        })
        .select("id")
        .single();

      if (checkInError || !checkIn) {
        throw new Error(checkInError?.message ?? "Falha ao criar check-in");
      }

      checkInId = checkIn.id;

      const { error } = await supabase
        .from("tally_submissions")
        .update({
          student_id: studentId,
          node_id: nodeId,
          check_in_id: checkIn.id,
          status: "linked",
          processed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw new Error(error.message);

      revalidateSubmission(id, studentId);
      revalidatePath(`/studio/checkins/${checkIn.id}`);

      after(async () => {
        await generateCheckInDraft(checkIn.id);
      });

      return {
        studentId,
        checkInId: checkIn.id,
        needsActiveNode: false,
        submissionKind: submission.submission_kind,
      };
    }

    const { data: orphan, error: orphanError } = await supabase
      .from("check_ins")
      .insert({
        node_id: null,
        level_label: "Sem nível associado",
        student_id: studentId,
        kind: submission.video_url ? "video" : "text",
        video_url: submission.video_url,
        notes: submission.notes,
        status: "pending",
      })
      .select("id")
      .single();

    if (orphanError || !orphan) {
      throw new Error(orphanError?.message ?? "Falha ao criar check-in");
    }

    checkInId = orphan.id;

    const { error: orphanLinkError } = await supabase
      .from("tally_submissions")
      .update({
        student_id: studentId,
        check_in_id: orphan.id,
        status: "linked",
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (orphanLinkError) throw new Error(orphanLinkError.message);

    revalidateSubmission(id, studentId);
    revalidatePath(`/studio/checkins/${orphan.id}`);

    after(async () => {
      await generateCheckInDraft(orphan.id);
    });

    return {
      studentId,
      checkInId: orphan.id,
      needsActiveNode: false,
      submissionKind: submission.submission_kind,
    };
  }

  const { error } = await supabase
    .from("tally_submissions")
    .update({
      student_id: studentId,
      status: "linked",
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // Onboarding → marcar perfil + proposal de brief
  if (submission.submission_kind === "onboarding") {
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", studentId)
      .eq("role", "student");

    const { data: full } = await supabase
      .from("tally_submissions")
      .select("answers, payload, source_form_name, notes")
      .eq("id", id)
      .maybeSingle();

    const { data: mentor } = await supabase.auth.getUser();
    const mentorId = mentor.user?.id;
    if (mentorId) {
      const raw = JSON.stringify(
        {
          form: full?.source_form_name,
          answers: full?.answers,
          payload: full?.payload,
          notes: full?.notes ?? submission.notes,
        },
        null,
        2,
      );
      await supabase.from("student_briefs").insert({
        student_id: studentId,
        raw_markdown: raw,
        structured: (full?.answers as import("@/lib/types/database.types").Json) ?? {},
        source: "tally",
        created_by: mentorId,
      });
      await supabase.from("agent_proposals").insert({
        kind: "student_brief",
        status: "pending",
        title: "Brief de onboarding Tally",
        summary: "Rever respostas do onboarding e completar notas do mentor",
        mentor_id: mentorId,
        payload: {
          student_id: studentId,
          tally_submission_id: id,
          raw_markdown: raw,
          structured: full?.answers ?? {},
          placeholder_name: null,
        },
        target_table: "student_briefs",
      });
    }
  }

  revalidateSubmission(id, studentId);
  revalidatePath("/studio/agent/inbox");
  revalidatePath("/home");
  revalidatePath("/onboarding");

  return {
    studentId,
    checkInId,
    needsActiveNode,
    submissionKind: submission.submission_kind,
  };
}

export async function archiveTallySubmission(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Submissao invalida");

  const { error } = await supabase
    .from("tally_submissions")
    .update({ status: "archived", processed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidateSubmission(id);
}

export async function deleteTallySubmission(formData: FormData) {
  const supabase = await mentorClient();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Submissao invalida");

  const { error } = await supabase.from("tally_submissions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/studio");
  revalidatePath("/studio/journeys");
  revalidatePath("/studio/journeys/checkins");
  revalidatePath("/studio/journeys/onboardings");
  revalidatePath("/studio/intake");
}
