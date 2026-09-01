#!/usr/bin/env node
/**
 * Backfill Eduardo Monteiro's Tally onboarding submission (webhook never fired).
 *
 * Usage: node apps/web/scripts/backfill-eduardo-onboarding.mjs
 * Idempotent: skips if a row already exists for source_event_id or respondent email.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");

const STUDENT_ID = "cd4e7d5a-c3f4-4d9d-941e-a918449d3d32";
const RESPONDENT_EMAIL = "eduardinho2021@gmail.com";
const ONBOARDING_FORM_ID =
  process.env.TALLY_ONBOARDING_FORM_ID ||
  process.env.NEXT_PUBLIC_TALLY_ONBOARDING_FORM_ID ||
  "44RJrA";
const BACKFILL_EVENT_ID = "backfill:eduardo-monteiro-onboarding";
const BACKFILL_RESPONSE_ID = "backfill-eduardo-onboarding";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = resolve(webRoot, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^"|"$/g, "").replace(/^'|'$/g, "");
      }
    }
  }
}

function field(key, label, type, value) {
  return { key, label, type, value };
}

function buildSubmissionData() {
  const fields = [
    field("a55288a3-5482-4472-8c28-471838e88515", "Qual o teu nome?", "INPUT_TEXT", "Eduardo E"),
    field("604ae37b-6b0b-4275-a333-fdb3bcdc9fba", "Qual a tua idade?", "INPUT_NUMBER", 20),
    field(
      "86a6d9ff-7ad7-43d5-a54c-230f363141b8",
      ", como descreves a tua relação atual com a música?",
      "MULTIPLE_CHOICE",
      "Sei o básico, mas estou estagnado",
    ),
    field(
      "e15a84b4-e646-48c6-b2c3-6375c55d5945",
      "Porquê?",
      "TEXTAREA",
      "Técnico — pouco entendimento de teoria musical",
    ),
    field(
      "3423c463-f3dc-4a83-9d06-e7f09d68c2f6",
      "Qual é o teu objetivo a curto e longo prazo?",
      "TEXTAREA",
      "Aprofundar a teoria e colocar em prática",
    ),
    field(
      "14b4343b-7566-48b9-a1bd-dc0a7e40fe12",
      "Porque é que tens esse objetivo?",
      "TEXTAREA",
      "Para ser um músico melhor e mais aprofundado",
    ),
    field(
      "ea61e981-937a-4cb5-8ab6-33382413533f",
      "Fala-me da tua experiência na música.\nJá foste acompanhado antes? ",
      "TEXTAREA",
      "Nunca fui acompanhado antes; todo o processo foi realizado sozinho com tutoriais",
    ),
    field(
      "3093280b-4bb0-4942-be84-bd44eafa31a0",
      "O que estás à espera de alcançar com a Neuma 1:1?",
      "TEXTAREA",
      "Ser melhor em todos os aspectos",
    ),
    field(
      "a2925c8b-0101-4154-9d47-c26d0f9e81d4",
      "Se fizer sentido avançarmos com este percurso,\ncomo vês a nossa timeline?",
      "MULTIPLE_CHOICE",
      "Médio prazo (3-6 meses)",
    ),
    field(
      "5e0e45d4-4bd0-4a69-b4f1-7d76f2850aba",
      "Para alinharmos expectativas, que faixa de investimento mensal estarias disposto(a) a investir?",
      "MULTIPLE_CHOICE",
      "Até 100€",
    ),
    field(
      "13ee43c4-64a3-4101-a6c2-2b1ef45c931e",
      "Neste momento da tua vida, onde encaixa o nosso trabalho nas tuas prioridades?",
      "MULTIPLE_CHOICE",
      "Curiosidade, sem urgência",
    ),
    field("193ecba6-0e70-4b2e-a223-09530742d6e9", "Email", "INPUT_EMAIL", RESPONDENT_EMAIL),
    field("11459f9d-76f4-4e5f-90f5-8cc711b751c7", "Whatsapp", "INPUT_PHONE_NUMBER", "+351937595235"),
    field(
      "14921da9-ff34-4e8f-9d8b-586b3b7f8e32",
      "Instagram",
      "INPUT_LINK",
      "https://www.instagram.com/itzz.eed",
    ),
    field("6171a334-29d6-4c7d-ba02-338e2ec05379", "Como preferes ser contactado?", "MULTIPLE_CHOICE", "Whatsapp"),
  ];

  const answers = fields.map(({ key, label, type, value }) => ({
    key,
    label,
    type,
    value,
    options: null,
  }));

  const payload = {
    eventId: BACKFILL_EVENT_ID,
    eventType: "FORM_RESPONSE",
    createdAt: new Date().toISOString(),
    data: {
      responseId: BACKFILL_RESPONSE_ID,
      submissionId: BACKFILL_RESPONSE_ID,
      formId: ONBOARDING_FORM_ID,
      formName: "Onboarding Neuma 1:1",
      createdAt: new Date().toISOString(),
      fields,
    },
  };

  return { answers, payload };
}

async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: existingByEvent } = await sb
    .from("tally_submissions")
    .select("id, status, student_id")
    .eq("source_event_id", BACKFILL_EVENT_ID)
    .maybeSingle();

  if (existingByEvent?.id) {
    console.log("Already backfilled:", existingByEvent.id);
    return;
  }

  const { data: existingByEmail } = await sb
    .from("tally_submissions")
    .select("id, status, student_id")
    .eq("submission_kind", "onboarding")
    .ilike("respondent_email", RESPONDENT_EMAIL)
    .neq("status", "archived")
    .maybeSingle();

  if (existingByEmail?.id) {
    console.log("Onboarding already exists for email:", existingByEmail.id);
    return;
  }

  const { data: student } = await sb
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", STUDENT_ID)
    .maybeSingle();

  if (!student?.id || student.role !== "student") {
    throw new Error(`Student profile not found or invalid: ${STUDENT_ID}`);
  }

  const { answers, payload } = buildSubmissionData();

  const row = {
    source: "tally",
    source_event_id: BACKFILL_EVENT_ID,
    source_response_id: BACKFILL_RESPONSE_ID,
    source_submission_id: BACKFILL_RESPONSE_ID,
    source_form_id: ONBOARDING_FORM_ID,
    source_form_name: "Onboarding Neuma 1:1",
    submission_kind: "onboarding",
    status: "pending",
    respondent_name: "Eduardo E",
    respondent_email: RESPONDENT_EMAIL,
    student_id: null,
    notes: null,
    answers,
    payload,
    processed_at: null,
  };

  const { data: inserted, error } = await sb
    .from("tally_submissions")
    .insert(row)
    .select("id, status, respondent_name, respondent_email, submission_kind, source_form_id")
    .single();

  if (error) throw error;

  console.log("Inserted Eduardo onboarding submission:");
  console.log(JSON.stringify(inserted, null, 2));
  console.log(`\nVerify:`);
  console.log(`  Studio onboardings: /studio/journeys/onboardings`);
  console.log(`  Intake detail:      /studio/intake/${inserted.id}`);
  console.log(`  Link to student:    ${STUDENT_ID} (${student.full_name})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
