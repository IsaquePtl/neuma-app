#!/usr/bin/env node
/**
 * Optional DRAFT path template for Teoria Musical.
 * Does NOT seed/re-seed the library. Does NOT activate students.
 *
 * Usage (from apps/web):
 *   node --experimental-strip-types --env-file=.env.local scripts/seed-teoria-musical.mjs
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

const { upsertTeoriaMusicalTemplate } = await import(
  pathToFileURL(resolve(webRoot, "lib/teoria-musical/upsert-template.ts")).href
);

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: mentor } = await admin
  .from("profiles")
  .select("id")
  .eq("role", "mentor")
  .limit(1)
  .maybeSingle();

const result = await upsertTeoriaMusicalTemplate(admin, mentor?.id ?? null);
console.log(
  `Template rascunho Teoria Musical: id=${result.templateId} nodes=${result.nodeCount}`,
);
console.log("Biblioteca não foi alterada. Alunos beta não foram activados.");
