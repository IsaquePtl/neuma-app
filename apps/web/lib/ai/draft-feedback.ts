import "server-only";

import { revalidatePath } from "next/cache";
import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

const PROMPT_VERSION = "v1";

const draftSchema = z.object({
  notes: z
    .string()
    .describe("Feedback principal ao aluno, na voz do mentor, em portugues PT"),
  next_steps: z
    .string()
    .describe("Proximos passos concretos e curtos para o aluno"),
  summary: z
    .string()
    .describe("Resumo interno de 1-2 frases do check-in para o mentor"),
});

export async function generateCheckInDraft(checkInId: string) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.info("[ai:skip] GOOGLE_GENERATIVE_AI_API_KEY em falta");
    return;
  }

  const admin = createAdminClient();

  const { data: checkIn } = await admin
    .from("check_ins")
    .select(
      "id, notes, video_url, kind, student_id, node:nodes(title, description), student:profiles!check_ins_student_id_fkey(full_name, email)",
    )
    .eq("id", checkInId)
    .single();

  if (!checkIn) return;

  const { data: mentor } = await admin
    .from("profiles")
    .select("id, full_name, mentor_style_notes")
    .eq("role", "mentor")
    .limit(1)
    .maybeSingle();

  const { data: pastFeedbacks } = await admin
    .from("feedbacks")
    .select("notes, next_steps")
    .eq("mentor_id", mentor?.id ?? "")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(5);

  const node = Array.isArray(checkIn.node) ? checkIn.node[0] : checkIn.node;
  const student = Array.isArray(checkIn.student)
    ? checkIn.student[0]
    : checkIn.student;

  const examples =
    pastFeedbacks
      ?.map(
        (f, i) =>
          `Exemplo ${i + 1}:\nNotas: ${f.notes ?? ""}\nProximos passos: ${f.next_steps ?? ""}`,
      )
      .join("\n\n") ?? "";

  try {
    const { object } = await generateObject({
      model: google("gemini-2.0-flash"),
      schema: draftSchema,
      system: `Escreves feedback de mentoria musical 1:1 em nome de ${mentor?.full_name ?? "o mentor"}.
Tom: humano, direto, encorajador, portugues de Portugal. Nunca digas que es uma IA.
${mentor?.mentor_style_notes ? `Notas de estilo do mentor:\n${mentor.mentor_style_notes}` : ""}
${examples ? `Exemplos de feedbacks anteriores aprovados:\n${examples}` : ""}`,
      prompt: `Aluno: ${student?.full_name ?? student?.email ?? "Aluno"}
Bloco: ${node?.title ?? "—"}
Descricao do bloco: ${node?.description ?? "—"}
Tipo de check-in: ${checkIn.kind}
Notas do aluno: ${checkIn.notes ?? "(sem notas)"}
Video: ${checkIn.video_url ? "sim" : "nao"}

Gera um rascunho de resposta e um resumo curto para o mentor.`,
    });

    await admin
      .from("check_ins")
      .update({ ai_summary: object.summary })
      .eq("id", checkInId);

    await admin.from("feedback_drafts").upsert(
      {
        check_in_id: checkInId,
        mentor_id: mentor?.id ?? null,
        status: "pending_review",
        body_notes: object.notes,
        body_next_steps: object.next_steps,
        model: "gemini-2.0-flash",
        prompt_version: PROMPT_VERSION,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "check_in_id" },
    );

    revalidatePath("/studio/journeys");
  revalidatePath("/studio/journeys/checkins");
  revalidatePath("/studio/journeys/onboardings");
    revalidatePath(`/studio/checkins/${checkInId}`);
    revalidatePath("/studio");
  } catch (err) {
    console.error("[ai:draft]", err);
    // Fallback minimo sem schema se generateObject falhar
    try {
      const { text } = await generateText({
        model: google("gemini-2.0-flash"),
        prompt: `Resume em 2 frases o check-in do aluno: ${checkIn.notes ?? ""}`,
      });
      await admin
        .from("check_ins")
        .update({ ai_summary: text })
        .eq("id", checkInId);
      revalidatePath("/studio/journeys");
  revalidatePath("/studio/journeys/checkins");
  revalidatePath("/studio/journeys/onboardings");
      revalidatePath(`/studio/checkins/${checkInId}`);
      revalidatePath("/studio");
    } catch {
      /* ignore */
    }
  }
}
