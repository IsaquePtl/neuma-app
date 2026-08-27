import type { ProfileGender } from "@/lib/types/database.types";

export const SIGNUP_PROFILE_DRAFT_KEY = "neuma-signup-profile";

export type SignupProfileDraft = {
  firstName: string;
  lastName: string;
  age: number;
  gender: ProfileGender;
};

export function parseGender(value: unknown): ProfileGender | null {
  if (value === "female" || value === "male" || value === "other") return value;
  return null;
}

export function parseAge(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value.trim(), 10)
        : NaN;
  if (!Number.isFinite(n) || n < 13 || n > 120) return null;
  return n;
}

export function composeFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export function readSignupProfileDraft(): SignupProfileDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SIGNUP_PROFILE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SignupProfileDraft>;
    const gender = parseGender(parsed.gender);
    const age = parseAge(parsed.age);
    const firstName = String(parsed.firstName ?? "").trim();
    const lastName = String(parsed.lastName ?? "").trim();
    if (!firstName || !lastName || age == null || !gender) return null;
    return { firstName, lastName, age, gender };
  } catch {
    return null;
  }
}

export function writeSignupProfileDraft(draft: SignupProfileDraft) {
  window.sessionStorage.setItem(SIGNUP_PROFILE_DRAFT_KEY, JSON.stringify(draft));
}

export function clearSignupProfileDraft() {
  window.sessionStorage.removeItem(SIGNUP_PROFILE_DRAFT_KEY);
}
