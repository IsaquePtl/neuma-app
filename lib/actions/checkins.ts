"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, sendEmail } from "@/lib/email";
import { generateCheckInDraft } from "@/lib/ai/draft-feedback";
import type { CheckInKind } from "@/lib/types/database.types";

export async function submitCheckIn(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");

  const nodeId = formData.get("node_id") as string;
  const kind = ((formData.get("kind") as CheckInKind) || "video");
  const videoUrl = ((formData.get("video_url") as string) || "").trim() || null;
  const notes = ((formData.get("notes") as string) || "").trim() || null;

  if (kind === "video" && !videoUrl) {
    throw new Error("O link do video e obrigatorio.");
  }
  if (kind === "text" && !notes) {
    throw new Error("As notas sao obrigatorias para check-in de texto.");
  }

  const { data: inserted, error } = await supabase
    .from("check_ins")
    .insert({
      node_id: nodeId,
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
  redirect("/session#conversa");
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
  redirect("/session#conversa");
}
