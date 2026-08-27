import type { ProfileGender } from "@/lib/types/database.types";

/** Saudação alinhada ao sexo do perfil. */
export function welcomeGreeting(gender: ProfileGender | null | undefined) {
  if (gender === "female") return "Bem vinda";
  return "Bem vindo";
}

export function firstNameFromFullName(fullName: string | null | undefined) {
  const v = (fullName ?? "").trim();
  if (!v) return null;
  return v.split(/\s+/)[0] ?? null;
}
