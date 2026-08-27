#!/usr/bin/env node
/**
 * Apply pending path_draft proposals (Márcio/Eduardo) and create library gaps.
 * Usage: node apps/web/scripts/apply-path-drafts-and-gaps.mjs
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

function slugify(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: proposals, error } = await sb
    .from("agent_proposals")
    .select("*")
    .eq("kind", "path_draft")
    .eq("status", "pending");
  if (error) throw error;

  const pathIds = [];

  for (const proposal of proposals ?? []) {
    const p = proposal.payload ?? {};
    const { data: path, error: pathErr } = await sb
      .from("paths")
      .insert({
        title: p.title,
        placeholder_name: p.placeholder_name ?? null,
        claim_email: p.claim_email ?? null,
        goal: p.goal ?? null,
        description: p.description ?? null,
        status: "draft",
        student_id: null,
        created_by: proposal.mentor_id,
      })
      .select("id")
      .single();
    if (pathErr) throw pathErr;
    pathIds.push(path.id);

    const nodes = Array.isArray(p.nodes) ? p.nodes : [];
    if (nodes.length) {
      const rows = nodes.map((n, i) => ({
        path_id: path.id,
        title: n.title,
        description: n.description ?? null,
        kind: ["lesson", "practice", "call", "milestone"].includes(n.kind)
          ? n.kind
          : "practice",
        order_index: n.order_index ?? i + 1,
        week_number: n.week_number ?? null,
        status: "locked",
      }));
      const { error: nodeErr } = await sb.from("nodes").insert(rows);
      if (nodeErr) throw nodeErr;
    }

    if (p.brief_id) {
      await sb
        .from("student_briefs")
        .update({
          path_id: path.id,
          placeholder_name: p.placeholder_name ?? null,
        })
        .eq("id", p.brief_id);
    }

    await sb
      .from("agent_proposals")
      .update({
        status: "applied",
        decided_at: new Date().toISOString(),
        decided_by: proposal.mentor_id,
        applied_at: new Date().toISOString(),
        target_id: path.id,
      })
      .eq("id", proposal.id);

    console.log(`Applied ${proposal.title} → path ${path.id}`);
  }

  // Library gaps from draft/active path node titles
  const { data: allNodes } = await sb
    .from("nodes")
    .select("id, title, kind, path:paths!inner(id, title, status, placeholder_name)")
    .in("path.status", ["draft", "active"]);

  const byCategory = new Map();
  for (const n of allNodes ?? []) {
    const path = Array.isArray(n.path) ? n.path[0] : n.path;
    const catName = path?.placeholder_name
      ? `Percurso ${path.placeholder_name}`
      : path?.title ?? "Geral";
    if (!byCategory.has(catName)) byCategory.set(catName, []);
    byCategory.get(catName).push(n);
  }

  let topicsCreated = 0;
  let assetsCreated = 0;

  for (const [catName, nodes] of byCategory) {
    const catSlug = slugify(catName);
    let { data: cat } = await sb
      .from("library_categories")
      .select("id")
      .eq("slug", catSlug)
      .maybeSingle();
    if (!cat) {
      const { data: created, error: cErr } = await sb
        .from("library_categories")
        .insert({ name: catName, slug: catSlug, sort_index: 0 })
        .select("id")
        .single();
      if (cErr) throw cErr;
      cat = created;
    }

    for (const n of nodes) {
      if (n.kind === "call" || n.kind === "milestone") continue;
      const topicSlug = slugify(n.title);
      let { data: topic } = await sb
        .from("library_topics")
        .select("id")
        .eq("category_id", cat.id)
        .eq("slug", topicSlug)
        .maybeSingle();
      if (!topic) {
        const { data: created, error: tErr } = await sb
          .from("library_topics")
          .insert({
            category_id: cat.id,
            name: n.title,
            slug: topicSlug,
            sort_index: 0,
            created_by_agent: true,
            rationale: `Necessário para o nível «${n.title}» do percurso.`,
          })
          .select("id")
          .single();
        if (tErr) throw tErr;
        topic = created;
        topicsCreated += 1;
      }

      const usage = n.kind === "practice" ? "practice" : "lesson";
      const { data: existingAsset } = await sb
        .from("library_assets")
        .select("id")
        .eq("topic_id", topic.id)
        .eq("title", n.title)
        .maybeSingle();
      if (!existingAsset) {
        const { error: aErr } = await sb.from("library_assets").insert({
          title: n.title,
          kind: "text",
          usage,
          topic_id: topic.id,
          content_status: "empty",
          created_by_agent: true,
          tags: ["agent-gap"],
        });
        if (aErr) throw aErr;
        assetsCreated += 1;
      }
    }
  }

  console.log(
    `Done. paths=${pathIds.length} topics+=${topicsCreated} assets+=${assetsCreated}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
