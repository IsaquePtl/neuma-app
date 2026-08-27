#!/usr/bin/env node
/**
 * Minimal E2E seed: 1 mentor (existing) + ensure 3 student profile markers.
 * Does not create auth users — documents expected states for manual/Playwright auth.
 *
 * Usage: node apps/web/scripts/seed-e2e.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");

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
loadEnv();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: mentors } = await sb
    .from("profiles")
    .select("id, email")
    .eq("role", "mentor")
    .limit(1);
  const { data: students } = await sb
    .from("profiles")
    .select("id, email, full_name")
    .eq("role", "student")
    .limit(10);
  const { data: paths } = await sb
    .from("paths")
    .select("id, title, status, student_id, placeholder_name")
    .order("created_at", { ascending: false })
    .limit(20);

  console.log(
    JSON.stringify(
      {
        mentor: mentors?.[0] ?? null,
        students: students ?? [],
        paths: paths ?? [],
        notes: [
          "States expected for E2E: student without path, mid-path, pending check-in",
          "Unassigned Márcio/Eduardo drafts claimable from student ficha",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
