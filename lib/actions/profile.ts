"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

function revalidateProfile() {
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/studio/settings");
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const bio = ((formData.get("bio") as string) || "").trim();

  const { error } = await supabase
    .from("profiles")
    .update({ bio: bio || null })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidateProfile();
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Escolhe uma fotografia");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("A foto deve ter no máximo 5 MB");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Só são aceites imagens");
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const avatarUrl = `${publicUrl}?v=${Date.now()}`;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidateProfile();
  return avatarUrl;
}

export async function requestEmailChange(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Indica um email válido");
  }
  if (email === (user.email ?? "").toLowerCase()) {
    throw new Error("É o mesmo email");
  }

  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw new Error(error.message);

  return "Enviámos um link de confirmação para o novo email.";
}
