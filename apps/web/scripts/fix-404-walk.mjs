import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = Date.now();
const email = `fix-404-${stamp}@example.com`;
const password = `fix-${stamp}-Neuma`;
let userId = null;
let browser = null;
let failed = 0;

function report(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Fix 404 Mentor" },
  });
  if (created.error || !created.data.user) throw created.error ?? new Error("create");
  userId = created.data.user.id;
  const role = await admin.from("profiles").update({ role: "mentor" }).eq("id", userId);
  if (role.error) throw role.error;

  const { data: path } = await admin
    .from("paths")
    .select("id, title")
    .eq("id", "c9209f7a-e644-4348-a9e4-f5ade5e972c4")
    .maybeSingle();
  const { data: node } = await admin
    .from("nodes")
    .select("id")
    .eq("path_id", path.id)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("http://localhost:3001/login", { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/studio/, { timeout: 20000 });

  const checks = [
    ["/studio", "Exige acção"],
    ["/studio/journeys", "Percursos"],
    ["/studio/journeys/checkins", "Check-ins"],
    ["/studio/journeys/onboardings", "Onboardings"],
    [`/studio/journeys/${path.id}`, path.title],
    [`/studio/journeys/${path.id}/edit`, path.title],
    [`/studio/journeys/${path.id}/levels/${node.id}`, null],
    ["/studio/students", null],
    ["/studio/calendar", "Calendário"],
    ["/studio/finance", "Finanças"],
    ["/studio/finance/one-to-one", null],
    ["/studio/library", "Biblioteca"],
    ["/studio/tools", null],
    ["/studio/checkins", null],
  ];

  for (const [href, needle] of checks) {
    const response = await page.goto(`http://localhost:3001${href}`, {
      waitUntil: "networkidle",
    });
    const status = response?.status() ?? 0;
    const body = await page.locator("body").innerText();
    const is404 =
      status === 404 ||
      /página não encontrada/i.test(body) ||
      /this page could not be found/i.test(body) ||
      (/^404$/m.test(body) && body.length < 500);
    const textOk = needle ? body.includes(needle) : !is404;
    report(
      href,
      status === 200 && !is404 && textOk,
      `status=${status}${textOk ? "" : ` needle=${needle}`}${is404 ? " notfound-ui" : ""} body=${body.slice(0, 120).replaceAll("\n", " | ")}`,
    );
  }
} catch (error) {
  report("walk", false, error instanceof Error ? error.message : String(error));
} finally {
  await browser?.close();
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log(failed === 0 ? "ALL_PASS" : `FAILURES ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}
