import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { agentEventsUrl, agentStartRun } from "@/lib/agent/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "mentor") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  let threadId = body.threadId as string | undefined;
  if (!threadId || body.newThread) {
    const { data: thread, error } = await supabase
      .from("agent_threads")
      .insert({
        mentor_id: profile.id,
        title: message.slice(0, 80),
        pattern: body.pattern ?? "supervisor",
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !thread) {
      return NextResponse.json({ error: error?.message ?? "thread" }, { status: 500 });
    }
    threadId = thread.id;
  } else {
    await supabase
      .from("agent_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId)
      .eq("mentor_id", profile.id);
  }

  try {
    const started = await agentStartRun({
      pattern: body.pattern ?? "supervisor",
      message,
      mentorId: profile.id,
      threadId,
      pageContext: body.pageContext,
      newThread: false,
    });
    return NextResponse.json({
      runId: started.run_id,
      threadId: started.thread_id,
      model: started.model,
      eventsPath: `/api/agent/events/${started.run_id}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

/** Proxy SSE from private agent service to the browser. */
export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }

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
