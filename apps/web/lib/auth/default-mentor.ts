/** Mentor por omissão para alunos novos / sem vínculo. */
import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_MENTOR_EMAIL =
  process.env.DEFAULT_MENTOR_EMAIL?.trim() ||
  "isaqueportilho2014@gmail.com";

/**
 * Garante profiles.mentor_id para alunos sem mentor.
 * Idempotente; não altera mentors; não falha o fluxo de auth se o mentor não existir.
 */
export async function ensureDefaultMentorForStudent(
  studentId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, mentor_id")
      .eq("id", studentId)
      .maybeSingle();

    if (!profile || profile.role !== "student" || profile.mentor_id) {
      return;
    }

    const { data: mentor } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", DEFAULT_MENTOR_EMAIL)
      .eq("role", "mentor")
      .maybeSingle();

    if (!mentor?.id) {
      console.warn(
        `[ensureDefaultMentor] perfil mentor não encontrado para ${DEFAULT_MENTOR_EMAIL}`,
      );
      return;
    }

    if (mentor.id === studentId) return;

    const { error } = await admin
      .from("profiles")
      .update({ mentor_id: mentor.id })
      .eq("id", studentId)
      .eq("role", "student")
      .is("mentor_id", null);

    if (error) {
      console.warn("[ensureDefaultMentor] update falhou:", error.message);
    }
  } catch (err) {
    console.warn("[ensureDefaultMentor] skipped:", err);
  }
}
