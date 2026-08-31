/** Perfil de aluno ainda por completar no wizard (idade/sexo em falta). */
export function isStudentSignupIncomplete(profile: {
  role?: string | null;
  age?: number | null;
  gender?: string | null;
}) {
  if (profile.role === "mentor") return false;
  return profile.age == null || profile.gender == null;
}

/** Extrai nome a partir de metadata OAuth (Google/Apple). */
export function namesFromOAuthMetadata(meta: Record<string, unknown> | undefined) {
  if (!meta) return { firstName: "", lastName: "" };

  const firstName = String(meta.first_name ?? meta.given_name ?? "").trim();
  const lastName = String(meta.last_name ?? meta.family_name ?? "").trim();
  if (firstName || lastName) return { firstName, lastName };

  const full = String(meta.full_name ?? meta.name ?? "").trim();
  if (!full) return { firstName: "", lastName: "" };

  const parts = full.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
