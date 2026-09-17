#!/usr/bin/env node
/**
 * Seed QA path for Ana Ribeiro + ready library stubs.
 * Does NOT activate Eduardo / Márcio / Bernardo or other beta paths.
 *
 * Usage (from apps/web):
 *   node --experimental-strip-types --env-file=.env.local scripts/seed-qa-ana-path.mjs
 *   node --experimental-strip-types --env-file=.env.local scripts/seed-qa-ana-path.mjs --reset
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const reset = process.argv.includes("--reset");

const { applyQaPathToAna } = await import(
  pathToFileURL(resolve(webRoot, "lib/qa-path/apply-path.ts")).href
);
const { ANA_EMAIL, QA_TEMPLATE_TITLE } = await import(
  pathToFileURL(resolve(webRoot, "lib/qa-path/curriculum.ts")).href
);

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: mentor } = await admin
  .from("profiles")
  .select("id, email")
  .eq("role", "mentor")
  .limit(1)
  .maybeSingle();

const result = await applyQaPathToAna(admin, {
  mentorId: mentor?.id ?? null,
  reset,
});

console.log(
  JSON.stringify(
    {
      template: QA_TEMPLATE_TITLE,
      email: ANA_EMAIL,
      mentor: mentor?.email ?? null,
      ...result,
      notes: [
        "Biblioteca QA Teste: 1 vídeo lesson, 1 vídeo practice, 1 texto (ready).",
        "Path status=active, primeiro nó active.",
        "Eduardo/Márcio/Bernardo NÃO foram activados.",
        reset
          ? "Reset: percurso QA anterior da Ana foi recriado."
          : "Reusa o path existente se já houver um deste template.",
      ],
    },
    null,
    2,
  ),
);
