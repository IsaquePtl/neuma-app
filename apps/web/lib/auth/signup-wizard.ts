export type SignupWizardStep =
  | "identity"
  | "credentials"
  | "plan"
  | "profile";

export const SIGNUP_WIZARD_STEP_KEY = "neuma-signup-step";
export const SIGNUP_FINISHING_COOKIE = "neuma-signup-finishing";

const VALID_STEPS: readonly SignupWizardStep[] = [
  "identity",
  "credentials",
  "plan",
  "profile",
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

const SIGNUP_FINISHING_UI_KEY = "neuma-signup-finishing-ui";

export function setSignupFinishingCookie() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SIGNUP_FINISHING_UI_KEY, "1");
  void import("@/lib/actions/signup-finishing").then((mod) =>
    mod.setSignupFinishingCookieAction(),
  );
}

export function clearSignupFinishingCookie() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SIGNUP_FINISHING_UI_KEY);
  void import("@/lib/actions/signup-finishing").then((mod) =>
    mod.clearSignupFinishingCookieAction(),
  );
}

export function hasSignupFinishingCookie() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SIGNUP_FINISHING_UI_KEY) === "1";
}
