"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  return { supabase, mentorId: user.id };
}

function revalidateStudentHub(studentId: string) {
  revalidatePath(`/studio/students/${studentId}`);
  revalidatePath(`/studio/students/${studentId}/checkins`);
  revalidatePath("/studio/students");
}

export async function updateStudentNotes(formData: FormData) {
  const { supabase } = await requireMentor();
  const studentId = formData.get("student_id") as string;
  const notes =
    ((formData.get("internal_notes") as string) || "").trim() || null;

  await supabase
    .from("profiles")
    .update({ internal_notes: notes })
    .eq("id", studentId)
    .eq("role", "student");

  revalidateStudentHub(studentId);
}

export async function updateStudentProfile(formData: FormData) {
  const { supabase } = await requireMentor();
  const studentId = formData.get("student_id") as string;
  const fullName =
    ((formData.get("full_name") as string) || "").trim() || null;

  await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", studentId)
    .eq("role", "student");

  revalidateStudentHub(studentId);
}

export async function setStudentOnboarding(formData: FormData) {
  const { supabase } = await requireMentor();
  const studentId = formData.get("student_id") as string;
  const completed = formData.get("onboarding_completed") === "on";

  await supabase
    .from("profiles")
    .update({ onboarding_completed: completed })
    .eq("id", studentId)
    .eq("role", "student");

  revalidateStudentHub(studentId);
}

export async function setStudentCanBookSessions(formData: FormData) {
  const { supabase } = await requireMentor();
  const studentId = formData.get("student_id") as string;
  const enabled = formData.get("can_book_sessions") === "on";

  await supabase
    .from("profiles")
    .update({ can_book_sessions: enabled })
    .eq("id", studentId)
    .eq("role", "student");

  revalidateStudentHub(studentId);
  revalidatePath("/session");
  revalidatePath("/path");
}

export type RemoveStudentResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Hard-delete de aluno (auth.users → profiles em cascade + dados ligados).
 * Só mentor (login do studio / admin da app). Confirmação por email obrigatória.
 */
export async function removeStudent(input: {
  studentId: string;
  confirmEmail: string;
}): Promise<RemoveStudentResult> {
  let mentorId: string;
  try {
    ({ mentorId } = await requireMentor());
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Sem permissão",
    };
  }

  const studentId = input.studentId.trim();
  const confirmEmail = input.confirmEmail.trim().toLowerCase();

  if (!studentId || !confirmEmail) {
    return { ok: false, error: "Confirmação incompleta." };
  }
  if (studentId === mentorId) {
    return { ok: false, error: "Não podes remover a tua própria conta." };
  }

  // Service role: bypass RLS; a authz já foi feita em requireMentor.
  const admin = createAdminClient();
  const { data: student, error: loadErr } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("id", studentId)
    .single();

  if (loadErr || !student) {
    return { ok: false, error: "Aluno não encontrado." };
  }
  if (student.role !== "student") {
    return { ok: false, error: "Só é possível remover contas de aluno." };
  }
  if ((student.email ?? "").toLowerCase() !== confirmEmail) {
    return {
      ok: false,
      error: "O email não coincide. Escreve exactamente o email do aluno.",
    };
  }

  // Cancela subscricoes Stripe ANTES de apagar a conta, senao continuamos
  // a cobrar o cartao de alguem que ja nao existe na app.
  try {
    const { data: subs } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("profile_id", studentId)
      .in("status", ["active", "trialing", "past_due", "paused", "unpaid", "incomplete"]);

    if (subs?.length) {
      const { getStripe } = await import("@/lib/stripe/client");
      const stripe = getStripe();
      if (stripe) {
        for (const sub of subs) {
          try {
            await stripe.subscriptions.cancel(sub.stripe_subscription_id, {
              prorate: false,
              invoice_now: false,
            });
          } catch (error) {
            console.error(
              "[removeStudent:stripe]",
              sub.stripe_subscription_id,
              error,
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("[removeStudent:list-subs]", error);
  }

  // Best-effort: limpar ficheiros de storage do aluno antes de apagar o user.
  await removeStudentStorage(admin, studentId);

  const { error: deleteErr } = await admin.auth.admin.deleteUser(studentId);
  if (deleteErr) {
    return { ok: false, error: deleteErr.message };
  }

  revalidatePath("/studio/students");
  revalidatePath("/studio");
  revalidatePath("/studio/journeys");
  revalidatePath(`/studio/students/${studentId}`);
  return { ok: true as const };
}

async function removeStudentStorage(
  admin: ReturnType<typeof createAdminClient>,
  studentId: string,
) {
  for (const bucket of ["avatars", "check-ins"] as const) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(studentId, {
        limit: 100,
      });
      if (!files?.length) continue;
      const paths = files.map((f) => `${studentId}/${f.name}`);
      await admin.storage.from(bucket).remove(paths);
    } catch {
      // Storage é best-effort; o hard-delete do auth/perfil continua.
    }
  }
}
