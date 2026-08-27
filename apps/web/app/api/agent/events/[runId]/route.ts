import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { agentEventsUrl } from "@/lib/agent/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ runId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { runId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const token = process.env.NEUMA_AGENT_TOKEN?.trim();
  const upstream = await fetch(agentEventsUrl(runId), {
    headers: token ? { "X-Neuma-Agent-Token": token } : {},
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `upstream ${upstream.status}` },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
