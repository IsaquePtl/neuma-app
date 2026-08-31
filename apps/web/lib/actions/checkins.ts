"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCheckInKey, uploadToR2 } from "@/lib/storage/r2";
import { appUrl, sendEmail } from "@/lib/email";
import { generateCheckInDraft } from "@/lib/ai/draft-feedback";
import { assertCanSubmitCheckIn } from "@/lib/checkins/allowance";
import type { CheckInKind } from "@/lib/types/database.types";
import {
  MAX_VIDEO_BYTES,
  videoTooLargeMessage,
} from "@/lib/uploads/video-limits";

async function assertStudentCheckInNode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  nodeId: string | null,
) {
  if (!nodeId) return;

  const { data: node, error } = await supabase
    .from("nodes")
    .select("id, path:paths!inner(student_id, status)")
    .eq("id", nodeId)
    .maybeSingle();

  if (error || !node) {
    throw new Error("Nível inválido ou inacessível.");
  }

  const path = Array.isArray(node.path) ? node.path[0] : node.path;
  if (!path || path.student_id !== userId) {
    throw new Error("Este nível não pertence ao teu percurso.");
  }
  if (path.status === "draft" || path.status === "paused") {
    throw new Error(
      path.status === "paused"
        ? "Este percurso está em pausa."
        : "Este percurso ainda não está activo.",
    );
  }
}

/** Upload de vídeo de check-in no servidor (fallback; preferir presigned PUT). */
export async function uploadCheckInVideo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const file = formData.get("video");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Ficheiro inválido");
  }
  if (!file.type.startsWith("video/")) {
    throw new Error("Escolhe um ficheiro de vídeo (MP4, MOV, etc.)");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(videoTooLargeMessage());
  }

  const key = buildCheckInKey(user.id, file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  const url = await uploadToR2(key, bytes, file.type);

  return { url };
}

export async function submitCheckIn(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");

  const nodeId = ((formData.get("node_id") as string) || "").trim() || null;
  const kind = ((formData.get("kind") as CheckInKind) || "video");
  const videoUrl = ((formData.get("video_url") as string) || "").trim() || null;
  const difficultyNotes =
    ((formData.get("difficulty_notes") as string) ||
      (formData.get("notes") as string) ||
      "")
      .trim() || null;
  const confidence = ((formData.get("confidence") as string) || "").trim();

  const CONFIDENCE_LABELS: Record<string, string> = {
    confident: "Confiante — Dominei o conceito e quero avançar",
    progress:
      "Em progresso — Consegui executar, mas ainda preciso de ajustes",
    blocked:
      "Bloqueado — Tive dificuldade e preciso de ajuda específica nesta parte",
  };

  const notesParts: string[] = [];
  if (difficultyNotes) {
    notesParts.push(`Como correu / dificuldades:\n${difficultyNotes}`);
  }
  if (confidence && CONFIDENCE_LABELS[confidence]) {
    notesParts.push(
      `Como me sinto neste nível:\n${CONFIDENCE_LABELS[confidence]}`,
    );
  }
  const notes = notesParts.length ? notesParts.join("\n\n") : null;

  if (kind === "video") {
    if (!videoUrl) throw new Error("O vídeo é obrigatório.");
    if (!difficultyNotes) {
      throw new Error("Descreve como correu e onde sentiste dificuldade.");
    }
    if (!confidence || !CONFIDENCE_LABELS[confidence]) {
      throw new Error("Escolhe como te sentes neste nível.");
    }
  }
  if (kind === "text" && !notes) {
    throw new Error("As notas são obrigatórias para check-in de texto.");
  }

  await assertStudentCheckInNode(supabase, user.id, nodeId);
  if (nodeId) {
    await assertCanSubmitCheckIn(supabase, nodeId, user.id);
  }

  const { data: inserted, error } = await supabase
    .from("check_ins")
    .insert({
      node_id: nodeId,
      level_label: nodeId ? null : "Sem nível associado",
      student_id: user.id,
      kind,
      video_url: videoUrl,
      notes,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Falha ao criar check-in");
  }

  const checkInId = inserted.id;

  after(async () => {
    await generateCheckInDraft(checkInId);

    try {
      const admin = createAdminClient();
      const { data: mentor } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("role", "mentor")
        .limit(1)
        .maybeSingle();
      const { data: student } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      if (mentor?.email) {
        await sendEmail({
          to: mentor.email,
          subject: `Novo check-in de ${student?.full_name ?? student?.email ?? "aluno"}`,
          html: `<p>Ha um novo check-in por rever.</p><p><a href="${appUrl(`/studio/checkins/${checkInId}`)}">Abrir na Neuma</a></p>`,
        });
      }
    } catch (e) {
      console.error("[notify:checkin]", e);
    }
  });

  revalidatePath("/checkins");
  revalidatePath("/home");
  revalidatePath("/session");
  revalidatePath("/studio/journeys");
  revalidatePath("/studio/journeys/checkins");
  revalidatePath("/studio/journeys/onboardings");
  redirect("/session");
}
export async function submitMentorshipMessage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");

  const nodeId = formData.get("node_id") as string;
  const notes = ((formData.get("notes") as string) || "").trim();

  if (!nodeId) throw new Error("Sem bloco ativo para enviar mensagem.");
  if (!notes) throw new Error("Escreve uma mensagem.");

  const { data: inserted, error } = await supabase
    .from("check_ins")
    .insert({
      node_id: nodeId,
      student_id: user.id,
      kind: "text",
      video_url: null,
      notes,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Falha ao enviar mensagem");
  }

  const checkInId = inserted.id;

  after(async () => {
    await generateCheckInDraft(checkInId);
    try {
      const admin = createAdminClient();
      const { data: mentor } = await admin
        .from("profiles")
        .select("email")
        .eq("role", "mentor")
        .limit(1)
        .maybeSingle();
      const { data: student } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      if (mentor?.email) {
        await sendEmail({
          to: mentor.email,
          subject: `Nova mensagem 1:1 de ${student?.full_name ?? student?.email ?? "aluno"}`,
          html: `<p>Ha uma nova mensagem no espaco 1:1.</p><p><a href="${appUrl(`/studio/checkins/${checkInId}`)}">Abrir na Neuma</a></p>`,
        });
      }
    } catch (e) {
      console.error("[notify:mentorship-message]", e);
    }
  });

  revalidatePath("/session");
  revalidatePath("/home");
  revalidatePath("/checkins");
  revalidatePath("/studio/checkins");
  redirect("/session");
}
