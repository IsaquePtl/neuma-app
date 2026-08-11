"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function submitStudentReview(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");

  const body = ((formData.get("body") as string) || "").trim();
  const topic = ((formData.get("topic") as string) || "geral").trim() || "geral";
  const ratingRaw = ((formData.get("rating") as string) || "").trim();
  const rating = ratingRaw ? Number(ratingRaw) : null;

  if (!body) throw new Error("Escreve a tua opinião.");
  if (rating != null && (Number.isNaN(rating) || rating < 1 || rating > 5)) {
    throw new Error("A nota deve ser entre 1 e 5.");
  }

  const { error } = await supabase.from("student_reviews").insert({
    student_id: user.id,
    topic,
    rating,
    body,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/session");
  revalidatePath("/session/review");
  redirect("/session?reviewed=1");
}
