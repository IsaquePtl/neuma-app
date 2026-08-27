#!/usr/bin/env node
/**
 * Wipe library taxonomy + assets (and storage bucket objects).
 * Default: dry-run. Pass --confirm to execute.
 *
 * Usage:
 *   node apps/web/scripts/wipe-library.mjs
 *   node apps/web/scripts/wipe-library.mjs --confirm
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirm = process.argv.includes("--confirm");

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function count(table) {
  const { count, error } = await sb.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const before = {
    library_assets: await count("library_assets"),
    library_topics: await count("library_topics"),
    library_categories: await count("library_categories"),
  };
  console.log("Before:", before);

  const { data: assets } = await sb
    .from("library_assets")
    .select("id, storage_path, url, title");

  console.log(`Assets to remove: ${(assets || []).length}`);

  if (!confirm) {
    console.log("Dry-run only. Re-run with --confirm to wipe.");
    process.exit(0);
  }

  // Clear FK refs on template nodes
  await sb.from("path_template_nodes").update({ library_asset_id: null }).not("library_asset_id", "is", null);

  // Clear copied content on live nodes that look like library urls (best-effort)
  // (we do not wipe all content_body — only null resource_url when matching storage)

  // Delete storage objects
  const paths = (assets || [])
    .map((a) => a.storage_path)
    .filter(Boolean);
  if (paths.length) {
    const { error } = await sb.storage.from("library").remove(paths);
    if (error) console.warn("storage remove warning:", error.message);
  }

  // Delete rows (topics cascade from categories; assets first)
  const { error: e1 } = await sb.from("library_assets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (e1) throw e1;
  const { error: e2 } = await sb.from("library_topics").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (e2) throw e2;
  const { error: e3 } = await sb.from("library_categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (e3) throw e3;

  const after = {
    library_assets: await count("library_assets"),
    library_topics: await count("library_topics"),
    library_categories: await count("library_categories"),
  };
  console.log("After:", after);
  console.log("Library wiped.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
