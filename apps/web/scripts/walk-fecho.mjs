import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import Stripe from "stripe";

function loadEnv(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
      }),
  );
}

const env = loadEnv(new URL("../.env.local", import.meta.url));
const base = "http://localhost:3001";
let failed = 0;

function report(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = Date.now();
const studentEmail = `walk-aluno-${stamp}@example.com`;
const mentorEmail = `walk-mentor-${stamp}@example.com`;
const password = `walk-${stamp}-Neuma`;
let studentId = null;
let mentorId = null;
let browser = null;

async function login(page, email) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

function card(page, title) {
  return page.locator("div.rounded-2xl").filter({ hasText: title }).last();
}

async function stripeCatalog() {
  if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test")) {
    report("stripe em test mode", false, "chave não é sk_test");
    return;
  }
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const expected = [
    ["monthly", "neuma_monthly", 2494, "month", 1],
    ["quarterly", "neuma_quarterly", 6294, "month", 3],
    ["annual", "neuma_annual", 19894, "year", 1],
  ];
  for (const [plan, key, cents, interval, count] of expected) {
    let list = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
    let price = list.data[0];
    const matches =
      price &&
      price.unit_amount === cents &&
      price.currency === "eur" &&
      price.recurring?.interval === interval &&
      price.recurring?.interval_count === count;
    if (!matches) {
      const product = await stripe.products.create({ name: `Neuma ${plan}` });
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: cents,
        currency: "eur",
        recurring: { interval, interval_count: count },
        lookup_key: key,
        transfer_lookup_key: true,
      });
    }
    report(
      `preço ${plan}`,
      price.unit_amount === cents &&
        price.recurring?.interval === interval &&
        price.recurring?.interval_count === count,
      `${price.unit_amount} ${price.recurring?.interval}x${price.recurring?.interval_count}`,
    );
    if (plan === "monthly") {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: "http://localhost:3001/subscrever/sucesso?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "http://localhost:3001/subscrever",
      });
      report("checkout mensal cria sessão", Boolean(session.url?.includes("checkout.stripe.com")));
      await stripe.checkout.sessions.expire(session.id);
    }
  }
}

async function unsignedWebhooks() {
  const stripeRes = await fetch(`${base}/api/stripe/webhook`, {
    method: "POST",
    body: "{}",
  });
  report("webhook stripe sem assinatura falha", stripeRes.status === 400 || stripeRes.status === 503, String(stripeRes.status));
  const tallyRes = await fetch(`${base}/api/tally/webhook`, { method: "POST", body: "{}" });
  report("webhook tally sem assinatura falha", tallyRes.status === 401, String(tallyRes.status));
  const calRes = await fetch(`${base}/api/cal/webhook`, { method: "POST", body: "{}" });
  report("webhook cal sem assinatura falha", calRes.status === 401, String(calRes.status));
  const sse = await fetch(`${base}/api/agent/stream?runId=00000000-0000-0000-0000-000000000000`);
  report("stream do agente sem sessão falha", sse.status === 401 || sse.status === 403, String(sse.status));
}

try {
  await stripeCatalog();
  await unsignedWebhooks();

  const student = await admin.auth.admin.createUser({
    email: studentEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Walk Aluno" },
  });
  if (student.error || !student.data.user) throw student.error ?? new Error("aluno");
  studentId = student.data.user.id;

  const mentor = await admin.auth.admin.createUser({
    email: mentorEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Walk Mentor" },
  });
  if (mentor.error || !mentor.data.user) throw mentor.error ?? new Error("mentor");
  mentorId = mentor.data.user.id;
  const role = await admin.from("profiles").update({ role: "mentor" }).eq("id", mentorId);
  if (role.error) throw role.error;

  const onboarding = await admin.from("tally_submissions").insert({
    source_form_id: "walk",
    submission_kind: "onboarding",
    status: "processed",
    respondent_email: studentEmail,
    student_id: studentId,
    payload: {},
  });
  if (onboarding.error) throw onboarding.error;

  browser = await chromium.launch({ headless: true });
  const studentPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const wavs = [];
  studentPage.on("response", (res) => {
    if (res.url().includes("/audio/Metronome")) wavs.push(res.status());
  });

  await login(studentPage, studentEmail);
  await studentPage.waitForURL(/\/subscrever/, { timeout: 20000 });
  report("conta nova sem pagar cai no paywall", studentPage.url().includes("/subscrever"));

  const until = new Date();
  until.setMonth(until.getMonth() + 1);
  const granted = await admin
    .from("profiles")
    .update({ is_one_to_one: true, one_to_one_access_until: until.toISOString() })
    .eq("id", studentId);
  if (granted.error) throw granted.error;

  await studentPage.goto(`${base}/home`, { waitUntil: "networkidle" });
  report("home sem percurso", (await studentPage.locator("body").innerText()).includes("Em desenvolvimento"));
  await studentPage.goto(`${base}/session`, { waitUntil: "networkidle" });
  report("sessão tem WhatsApp", (await studentPage.locator("body").innerText()).includes("WhatsApp"));
  await studentPage.goto(`${base}/settings`, { waitUntil: "networkidle" });
  report("definições abrem", studentPage.url().includes("/settings"));

  await studentPage.goto(`${base}/tools`, { waitUntil: "networkidle" });
  const piano = card(studentPage, "Construtor de acordes · Piano");
  const guitar = card(studentPage, "Construtor de acordes · Guitarra");
  report("piano começa em Dó maior", (await piano.locator("p").filter({ hasText: /^C$/ }).count()) > 0);
  report("guitarra começa em Dó maior", (await guitar.locator("p").filter({ hasText: /^C$/ }).count()) > 0);
  const pianoActive = await piano.getByRole("button", { name: "Nota activa" }).count();
  report("piano tem teclas do acorde", pianoActive >= 3, String(pianoActive));
  report("guitarra tem diagrama", (await guitar.getByLabel("Diagrama de acorde no braço da guitarra").count()) === 1);

  await studentPage.getByLabel("Iniciar metrónomo").click();
  await studentPage.waitForFunction(() =>
    [...document.querySelectorAll(".size-4.rounded-full")].some((node) =>
      node.className.includes("scale-125"),
    ),
  );
  report("metrónomo marca o tempo", true);
  report("samples do metrónomo carregam", wavs.some((status) => status === 200), wavs.join(","));
  await studentPage.getByLabel("Parar metrónomo").click();

  const bpm = studentPage.getByRole("textbox", { name: "BPM" });
  await bpm.fill("999");
  await bpm.blur();
  report("BPM 999 fica 240", (await bpm.inputValue()) === "240");
  await studentPage.getByRole("combobox").filter({ hasText: "4/4" }).click();
  await studentPage.getByRole("option", { name: "6/8" }).click();
  report("compasso 6/8", (await studentPage.getByRole("combobox").filter({ hasText: "6/8" }).count()) === 1);
  await studentPage.getByLabel("Desligar acentuação").click();
  report("acento desliga e o compasso continua", (await studentPage.getByRole("combobox").filter({ hasText: "6/8" }).count()) === 1);
  await piano.getByRole("button", { name: "Menor" }).click();
  await piano.getByRole("button", { name: "A", exact: true }).click();
  report("piano passa a Lá menor", (await piano.locator("p").filter({ hasText: /^Am$/ }).count()) > 0);

  const tom = studentPage.getByText("Tom", { exact: true }).locator("..").getByRole("combobox");
  await tom.click();
  await studentPage.getByRole("option", { name: "A", exact: true }).click();
  const escala = studentPage.getByText("Escala", { exact: true }).locator("..").getByRole("combobox");
  await escala.click();
  await studentPage.getByRole("option", { name: "Menor natural" }).click();
  const field = await studentPage.locator("body").innerText();
  report("Lá menor natural", field.includes("1m") && field.includes("2°"));

  await studentPage.setViewportSize({ width: 390, height: 844 });
  await studentPage.reload({ waitUntil: "networkidle" });
  report(
    "refresh estreito repõe Dó maior",
    (await card(studentPage, "Construtor de acordes · Piano").locator("p").filter({ hasText: /^C$/ }).count()) > 0,
  );
  await studentPage.getByLabel("Iniciar metrónomo").click();
  await studentPage.getByLabel("Parar metrónomo").waitFor();
  await studentPage.getByLabel("Parar metrónomo").click();
  report("metrónomo estreito", true);

  const mentorPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await login(mentorPage, mentorEmail);
  await mentorPage.waitForURL(/\/studio/, { timeout: 20000 });
  report("mentor entra no studio", mentorPage.url().includes("/studio"));
  report("nav sem multi-agent", (await mentorPage.locator("a[href='/studio/agent']").count()) === 0);

  for (const [path, needle] of [
    ["/studio", "Exige acção"],
    ["/studio/calendar?view=week", "Sem eventos"],
    ["/studio/finance", "Cortesia 1:1"],
    ["/studio/journeys", "Percursos"],
    ["/studio/library", "Biblioteca"],
  ]) {
    await mentorPage.goto(`${base}${path}`, { waitUntil: "networkidle" });
    const text = await mentorPage.locator("body").innerText();
    const ok =
      text.toLowerCase().includes(needle.toLowerCase()) &&
      !mentorPage.url().includes("/login");
    report(`studio ${path}`, ok, ok ? needle : text.slice(0, 400).replaceAll("\n", " | "));
  }

  await mentorPage.goto(`${base}/studio/tools`, { waitUntil: "networkidle" });
  const mentorPiano = card(mentorPage, "Construtor de acordes · Piano");
  const before = await mentorPiano.getByRole("button", { name: /Editar tecla/ }).count();
  await mentorPiano.getByRole("button", { name: /Editar tecla/ }).first().click();
  const box = mentorPage.getByRole("checkbox", { name: "Nota activa no voicing" });
  if (await box.isChecked()) await box.uncheck();
  else await box.check();
  await mentorPage.getByRole("button", { name: "Aplicar" }).click();
  await mentorPage.getByRole("button", { name: "Guardar alterações" }).click();
  await mentorPage.getByText("Tens alterações por guardar").waitFor({ state: "hidden", timeout: 15000 });
  report("mentor grava voicing", true);

  await studentPage.setViewportSize({ width: 1280, height: 900 });
  await studentPage.goto(`${base}/tools`, { waitUntil: "networkidle" });
  const afterStudent = await card(studentPage, "Construtor de acordes · Piano")
    .getByRole("button", { name: "Nota activa" })
    .count();
  report("aluno vê o override depois do refresh", afterStudent !== pianoActive, `${pianoActive} -> ${afterStudent}`);

  await mentorPage.reload({ waitUntil: "networkidle" });
  const mentorPianoAgain = card(mentorPage, "Construtor de acordes · Piano");
  await mentorPianoAgain.getByRole("button", { name: /Editar tecla/ }).first().click();
  const boxAgain = mentorPage.getByRole("checkbox", { name: "Nota activa no voicing" });
  if (await boxAgain.isChecked()) await boxAgain.uncheck();
  else await boxAgain.check();
  await mentorPage.getByRole("button", { name: "Aplicar" }).click();
  await mentorPage.getByRole("button", { name: "Guardar alterações" }).click();
  await mentorPage.getByText("Tens alterações por guardar").waitFor({ state: "hidden", timeout: 15000 });
  await studentPage.reload({ waitUntil: "networkidle" });
  const restored = await card(studentPage, "Construtor de acordes · Piano")
    .getByRole("button", { name: "Nota activa" })
    .count();
  report("repor voicing devolve o default", restored === pianoActive, `${restored} vs ${pianoActive}`);
  report("mentor ainda tem as teclas", before > 0);

  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const signed = await anon.auth.signInWithPassword({ email: studentEmail, password });
  const denied = await anon.from("chord_voicing_overrides").insert({
    instrument: "piano",
    chord_key: "C|major",
    voicing_id: "",
    payload: { notes: [] },
    updated_by: studentId,
  });
  report(
    "aluno não grava override",
    Boolean(signed.data.user) && Boolean(denied.error),
    denied.error?.code ?? denied.error?.message ?? "sem erro",
  );

  const forgot = await fetch(`${base}/login/forgot`);
  report("esqueci a password abre", forgot.status === 200, String(forgot.status));

  const drafts = await admin
    .from("paths")
    .select("title, status")
    .in("title", [
      "Eduardo — Harmonia e igreja",
      "Márcio — Braço e sonoridade",
      "Bernardo — Da mesa para a guitarra",
    ]);
  const stillDraft =
    (drafts.data ?? []).length === 3 && (drafts.data ?? []).every((row) => row.status === "draft");
  report("percursos reais continuam em rascunho", stillDraft);
} catch (error) {
  report("walk", false, error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  await browser?.close();
  if (mentorId) {
    await admin.from("chord_voicing_overrides").delete().eq("updated_by", mentorId);
    await admin.auth.admin.deleteUser(mentorId);
  }
  if (studentId) {
    await admin.from("tally_submissions").delete().eq("student_id", studentId);
    await admin.auth.admin.deleteUser(studentId);
  }
  console.log(failed === 0 ? "ALL_PASS" : `FAILURES ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}
