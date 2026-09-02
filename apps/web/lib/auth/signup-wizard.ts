export type SignupWizardStep =
  | "identity"
  | "credentials"
  | "profile"
  | "plan";

export const SIGNUP_WIZARD_STEP_KEY = "neuma-signup-step";
export const SIGNUP_FINISHING_COOKIE = "neuma-signup-finishing";

const VALID_STEPS: readonly SignupWizardStep[] = [
  "identity",
  "credentials",
  "profile",
  "plan",
];

export function readSignupWizardStep(): SignupWizardStep | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SIGNUP_WIZARD_STEP_KEY);
  if (raw && (VALID_STEPS as readonly string[]).includes(raw)) {
    return raw as SignupWizardStep;
  }
  return null;
}

export function writeSignupWizardStep(step: SignupWizardStep) {
  window.sessionStorage.setItem(SIGNUP_WIZARD_STEP_KEY, step);
}

export function clearSignupWizardStep() {
  window.sessionStorage.removeItem(SIGNUP_WIZARD_STEP_KEY);
}

export function setSignupFinishingCookie() {
  document.cookie = `${SIGNUP_FINISHING_COOKIE}=1; path=/; max-age=1800; SameSite=Lax`;
}

export function clearSignupFinishingCookie() {
  document.cookie = `${SIGNUP_FINISHING_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function hasSignupFinishingCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${SIGNUP_FINISHING_COOKIE}=1`));
}
