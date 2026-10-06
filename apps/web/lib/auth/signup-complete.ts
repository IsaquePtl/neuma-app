/** Perfil de aluno ainda por completar no wizard (idade/sexo em falta). */
export function isStudentSignupIncomplete(profile: {
  role?: string | null;
  age?: number | null;
  gender?: string | null;
}) {
  if (profile.role === "mentor") return false;
  return profile.age == null || profile.gender == null;
}

const FRESH_GOOGLE_SIGNUP_MS = 2 * 60 * 1000;

/**
 * Login com Google só reabre o wizard para uma conta nova ou um registo
 * a meio. Uma conta já usada, mesmo sem idade/sexo, entra na app.
 */
export function googleLoginShouldFinishSignup(
  profile: {
    role?: string | null;
    age?: number | null;
    gender?: string | null;
    signup_incomplete?: boolean | null;
    onboarding_completed?: boolean | null;
    created_at?: string | null;
  } | null,
) {
  if (!profile) return true;
  if (profile.role === "mentor") return false;
  if (profile.signup_incomplete) return true;
  if (profile.onboarding_completed) return false;

  const created = profile.created_at ? new Date(profile.created_at).getTime() : 0;
  const justCreated =
    created > 0 && Date.now() - created < FRESH_GOOGLE_SIGNUP_MS;
  return justCreated && isStudentSignupIncomplete(profile);
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
