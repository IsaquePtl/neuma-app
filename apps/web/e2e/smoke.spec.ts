import { test, expect } from "@playwright/test";

const PUBLIC_ROUTES = ["/login", "/login/signup", "/login/forgot", "/onboarding"];

const STUDIO_ROUTES = [
  "/studio",
  "/studio/agent",
  "/studio/agent/inbox",
  "/studio/calendar",
  "/studio/checkins",
  "/studio/inbox",
  "/studio/intake",
  "/studio/journeys",
  "/studio/journeys/checkins",
  "/studio/journeys/onboardings",
  "/studio/library",
  "/studio/settings",
  "/studio/students",
  "/studio/tools",
];

const STUDENT_ROUTES = [
  "/home",
  "/path",
  "/session",
  "/checkins",
  "/checkins/new",
  "/settings",
  "/tools",
];

test.describe("public routes", () => {
  for (const path of PUBLIC_ROUTES) {
    test(`loads ${path}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.ok() || (res?.status() ?? 500) < 500).toBeTruthy();
      await expect(page.locator("body")).toBeVisible();
    });
  }
});

test.describe("auth gate", () => {
  for (const path of [...STUDIO_ROUTES, ...STUDENT_ROUTES]) {
    test(`${path} redirects unauthenticated users`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
