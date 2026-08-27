"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, sendEmail } from "@/lib/email";

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
  return { supabase, user };
}

export async function submitFeedback(formData: FormData) {
  const { supabase, user } = await mentorClient();

  const checkInId = formData.get("check_in_id") as string;
  const draftId = (formData.get("draft_id") as string) || null;
  const approved = formData.get("approved") === "on";
  const videoUrl = ((formData.get("video_url") as string) || "").trim() || null;
  const notes = ((formData.get("notes") as string) || "").trim() || null;
  const nextSteps = ((formData.get("next_steps") as string) || "").trim() || null;
  const returnTo = (formData.get("return_to") as string) || "";

  const { data: checkInRow } = await supabase
    .from("check_ins")
    .select("student_id")
    .eq("id", checkInId)
    .maybeSingle();
  const studentId = checkInRow?.student_id ?? null;

  await supabase
    .from("feedbacks")
    .upsert(
      {
        check_in_id: checkInId,
        mentor_id: user.id,
        video_url: videoUrl,
        notes,
        next_steps: nextSteps,
        approved,
      },
      { onConflict: "check_in_id" },
    );

  await supabase
    .from("check_ins")
    .update({ status: approved ? "approved" : "needs_revision" })
    .eq("id", checkInId);

  if (draftId) {
    await supabase
      .from("feedback_drafts")
      .update({
        status: "published",
        body_notes: notes,
        body_next_steps: nextSteps,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId);
  }

  if (approved) {
    const { data: checkIn } = await supabase
      .from("check_ins")
      .select("node_id, student_id")
      .eq("id", checkInId)
      .single();

    if (checkIn?.node_id) {
      const { data: node } = await supabase
        .from("nodes")
        .select("id, path_id, order_index")
        .eq("id", checkIn.node_id)
        .single();

      if (node) {
        await supabase
          .from("nodes")
          .update({ status: "completed" })
          .eq("id", node.id);

        const { data: next } = await supabase
          .from("nodes")
          .select("id")
          .eq("path_id", node.path_id)
          .gt("order_index", node.order_index)
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (next) {
          await supabase
            .from("nodes")
            .update({ status: "active" })
            .eq("id", next.id);
        } else {
          await supabase
            .from("paths")
            .update({ status: "completed" })
            .eq("id", node.path_id);
        }
      }
    }
  }

  after(async () => {
    try {
      const admin = createAdminClient();
      const { data: checkIn } = await admin
        .from("check_ins")
        .select("student_id, student:profiles!check_ins_student_id_fkey(email, full_name)")
        .eq("id", checkInId)
        .single();
      const student = Array.isArray(checkIn?.student)
        ? checkIn?.student[0]
        : checkIn?.student;
      if (student?.email) {
        await sendEmail({
          to: student.email,
          subject: approved
            ? "Tens feedback novo na Neuma"
            : "O mentor pediu uma revisao do teu check-in",
          html: `<p>Ola${student.full_name ? ` ${student.full_name}` : ""},</p><p>Ha novidades no teu check-in.</p><p><a href="${appUrl(`/checkins/${checkInId}`)}">Ver na Neuma</a></p>`,
        });
      }
    } catch (e) {
      console.error("[notify:feedback]", e);
    }
  });

  revalidatePath("/studio/journeys");
  revalidatePath("/studio/journeys/checkins");
  revalidatePath("/studio/journeys/onboardings");
  revalidatePath("/studio");
  revalidatePath(`/studio/checkins/${checkInId}`);
  revalidatePath("/home");
  revalidatePath("/session");
  revalidatePath("/checkins");
  if (studentId) {
    revalidatePath(`/studio/students/${studentId}`);
  }

  if (
    returnTo.startsWith("/studio/students/") ||
    returnTo.startsWith("/studio/journeys/")
  ) {
    redirect(returnTo);
  }

  const { data: nextPending } = await supabase
    .from("check_ins")
    .select("id")
    .eq("status", "pending")
    .neq("id", checkInId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextPending?.id) {
    redirect(`/studio/checkins/${nextPending.id}`);
  }

  redirect("/studio/journeys/checkins");
}
