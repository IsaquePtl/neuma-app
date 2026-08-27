/**
 * Client for the LangGraph agent service (private binding or local URL).
 */
import "server-only";

function agentBaseUrl() {
  return (
    process.env.AGENT_INTERNAL_URL?.trim() ||
    process.env.NEUMA_AGENT_URL?.trim() ||
    "http://127.0.0.1:8765"
  );
}

function agentHeaders(extra?: HeadersInit): HeadersInit {
  const token = process.env.NEUMA_AGENT_TOKEN?.trim();
  return {
    "Content-Type": "application/json",
    ...(token ? { "X-Neuma-Agent-Token": token } : {}),
    ...extra,
  };
}

export async function agentFetch(path: string, init?: RequestInit) {
  const url = `${agentBaseUrl().replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: agentHeaders(init?.headers),
    cache: "no-store",
  });
  return res;
}

export async function agentHealth() {
  try {
    const res = await agentFetch("/health");
    if (!res.ok) return { ok: false, status: res.status };
    return await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function agentBriefing(mentorId: string, mentorName: string) {
  const res = await agentFetch("/briefing", {
    method: "POST",
    body: JSON.stringify({ mentor_id: mentorId, mentor_name: mentorName }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`agent briefing failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<{
    briefing: string;
    model: string;
    local: boolean;
    facts_preview?: string;
  }>;
}

export async function agentStartRun(input: {
  pattern: string;
  message: string;
  mentorId: string;
  threadId?: string;
  pageContext?: string;
  newThread?: boolean;
}) {
  const res = await agentFetch("/run", {
    method: "POST",
    body: JSON.stringify({
      pattern: input.pattern,
      message: input.message,
      mentor_id: input.mentorId,
      thread_id: input.threadId,
      page_context: input.pageContext,
      new_thread: input.newThread ?? false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`agent run failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<{ run_id: string; thread_id: string; model: string }>;
}

export function agentEventsUrl(runId: string) {
  return `${agentBaseUrl().replace(/\/$/, "")}/events/${runId}`;
}
