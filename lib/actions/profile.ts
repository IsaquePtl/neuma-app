"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  normalizeInstagramHandle,
  normalizeWhatsappNumber,
} from "@/lib/social-links";

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
  const hasInstagram = formData.has("instagram");
  const hasWhatsapp = formData.has("whatsapp");

  const patch: {
    bio: string | null;
    instagram?: string | null;
    whatsapp?: string | null;
  } = {
    bio: bio || null,
  };

  if (hasInstagram) {
    const ig = normalizeInstagramHandle(
      (formData.get("instagram") as string) || "",
    );
    patch.instagram = ig || null;
  }
  if (hasWhatsapp) {
    const wa = normalizeWhatsappNumber(
      (formData.get("whatsapp") as string) || "",
    );
    patch.whatsapp = wa || null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
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
  // Após compressão no cliente fica tipicamente < 1 MB; margem para fallbacks
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("A foto é demasiado grande. Tenta outra imagem.");
  }

  const mime = (file.type || "").toLowerCase();
  const nameLower = file.name.toLowerCase();

  // Aceita qualquer imagem; iOS por vezes manda type vazio ou image/heic
  const looksLikeImage =
    mime.startsWith("image/") ||
    mime === "" ||
    /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
  if (!looksLikeImage) {
    throw new Error("Só são aceites fotografias");
  }

  const ext =
    mime === "image/png" || nameLower.endsWith(".png")
      ? "png"
      : mime === "image/webp" || nameLower.endsWith(".webp")
        ? "webp"
        : "jpg";
  const path = `${user.id}/avatar.${ext}`;
  const contentType =
    mime.startsWith("image/") && !mime.includes("heic") && !mime.includes("heif")
      ? mime
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      contentType,
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
