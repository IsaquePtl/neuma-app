"use server";

import { createClient } from "@/lib/supabase/server";
import { appUrl, sendEmail } from "@/lib/email";
import { agentBriefing } from "@/lib/agent/client";

export type MentorAgentSuggestion = {
  kind: "call_prep" | "checkin_nudge" | "review" | "insight" | "other";
  priority: "high" | "medium" | "low";
  title: string;
  body: string;
  actionType:
    | "none"
    | "open_checkin"
    | "open_student"
    | "open_calendar"
    | "nudge_checkins"
    | "open_proposals";
  actionLabel: string | null;
  studentIds: string[];
  checkInId: string | null;
  href: string | null;
};

export type MentorAgentBriefing = {
  briefing: string;
  items: MentorAgentSuggestion[];
  generatedAt: string;
  source: string;
  local: boolean;
};

type DashboardFacts = {
  generated_at?: string;
  pending_checkins?: Array<{
    id: string;
    created_at: string;
    student_id: string;
    student_name: string;
    node_title: string;
  }>;
  upcoming_sessions?: Array<{
    id: string;
    start_time: string;
    title: string | null;
    attendee_name: string | null;
    attendee_email: string | null;
    student_id: string | null;
    meet_url: string | null;
    active_node_title: string | null;
    active_node_index: number | null;
  }>;
  pending_onboardings?: number;
  active_paths?: number;
  quiet_students?: Array<{
    id: string;
    name: string;
    days_since_last_checkin: number | null;
    never_checked_in: boolean;
  }>;
  pending_proposals?: number;
};

async function requireMentor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, mentor_style_notes")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "mentor") throw new Error("Sem permissão");
  return { supabase, mentor: profile };
}

async function loadFacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<DashboardFacts> {
  const { data, error } = await supabase.rpc("mentor_dashboard_facts");
  if (error) {
    console.error("mentor_dashboard_facts", error);
    return {};
  }
  return (data ?? {}) as DashboardFacts;
}

function quietLabel(s: {
  name: string;
  days_since_last_checkin: number | null;
  never_checked_in: boolean;
}) {
  if (s.never_checked_in || s.days_since_last_checkin == null) {
    return `· ${s.name} (nunca fez check-in)`;
  }
  return `· ${s.name} (~${s.days_since_last_checkin} dias)`;
}

function buildLocalBriefing(facts: DashboardFacts): MentorAgentBriefing {
  const items: MentorAgentSuggestion[] = [];
  const upcoming = facts.upcoming_sessions ?? [];
  const pending = facts.pending_checkins ?? [];
  const quiet = facts.quiet_students ?? [];

  for (const u of upcoming.slice(0, 2)) {
    const when = new Date(u.start_time).toLocaleString("pt-PT", {
      dateStyle: "full",
      timeStyle: "short",
    });
    const who = u.attendee_name ?? u.attendee_email ?? "Convidado";
    const levelLine =
      u.active_node_title != null
        ? `Nível actual: ${u.active_node_index != null ? `#${u.active_node_index + 1} · ` : ""}${u.active_node_title}`
        : "Nível actual: (sem percurso activo)";
    items.push({
      kind: "call_prep",
      priority: "high",
      title: `Preparar call · ${who}`,
      body: [
        `Sessão: ${u.title ?? "Sessão"}`,
        `Quando: ${when}`,
        levelLine,
        "",
        "Roteiro rápido:",
        "1. Abrir com o que correu bem desde a última vez",
        "2. Rever o nível actual e o último check-in / feedback",
        "3. Definir 1 objectivo concreto até à próxima sessão",
        "4. Acordar próximo passo no percurso",
      ].join("\n"),
      actionType: u.student_id ? "open_student" : "open_calendar",
      actionLabel: u.student_id ? "Abrir ficha" : "Abrir calendário",
      studentIds: u.student_id ? [u.student_id] : [],
      checkInId: null,
      href: u.student_id
        ? `/studio/students/${u.student_id}`
        : "/studio/calendar",
    });
  }

  for (const c of pending.slice(0, 3)) {
    items.push({
      kind: "review",
      priority: "high",
      title: `Avaliar · ${c.student_name}`,
      body: `Check-in pendente no bloco «${c.node_title}».`,
      actionType: "open_checkin",
      actionLabel: "Avaliar",
      studentIds: [c.student_id],
      checkInId: c.id,
      href: `/studio/checkins/${c.id}?from=dashboard`,
    });
  }

  if (quiet.length > 0) {
    const top = quiet.slice(0, 5);
    items.push({
      kind: "checkin_nudge",
      priority: "medium",
      title: `${top.length} aluno(s) sem check-in recente`,
      body: top.map(quietLabel).join("\n"),
      actionType: "nudge_checkins",
      actionLabel: "Confirmar envio de lembretes",
      studentIds: top.map((s) => s.id),
      checkInId: null,
      href: null,
    });
  }

  if ((facts.pending_onboardings ?? 0) > 0) {
    items.push({
      kind: "insight",
      priority: "medium",
      title: `${facts.pending_onboardings} onboarding(s) por tratar`,
      body: "Há respostas de intake à espera em Percursos → Onboardings.",
      actionType: "none",
      actionLabel: null,
      studentIds: [],
      checkInId: null,
      href: "/studio/journeys/onboardings",
    });
  }

  if ((facts.pending_proposals ?? 0) > 0) {
    items.push({
      kind: "insight",
      priority: "medium",
      title: `${facts.pending_proposals} proposta(s) do Agent`,
      body: "Há propostas à espera de validação na Inbox do Agent.",
      actionType: "open_proposals",
      actionLabel: "Abrir Inbox",
      studentIds: [],
      checkInId: null,
      href: "/studio/agent/inbox",
    });
  }

  const bits: string[] = [];
  if (upcoming.length > 0) {
    bits.push(
      `${upcoming.length} sessão(ões) à frente (próxima: ${upcoming[0].attendee_name ?? upcoming[0].attendee_email ?? "convidado"}).`,
    );
  }
  if (pending.length > 0) {
    bits.push(`${pending.length} check-in(s) por avaliar.`);
  } else {
    bits.push("Sem check-ins pendentes.");
  }
  if (quiet.length > 0) {
    const never = quiet.filter((q) => q.never_checked_in).length;
    const stale = quiet.length - never;
    bits.push(
      `${quiet.length} aluno(s) quietos` +
        (never ? ` (${never} nunca fizeram check-in)` : "") +
        (stale ? ` (${stale} ≥7 dias)` : "") +
        ".",
    );
  }
  bits.push(`${facts.active_paths ?? 0} percurso(s) ativo(s).`);

  return {
    briefing: bits.join(" "),
    items: items.slice(0, 6),
    generatedAt: new Date().toISOString(),
    source: "Local (factos SQL)",
    local: true,
  };
}

export async function generateLocalMentorAgendaBriefing(): Promise<MentorAgentBriefing> {
  const { supabase } = await requireMentor();
  const facts = await loadFacts(supabase);
  return buildLocalBriefing(facts);
}

/**
 * Só o upgrade via LangGraph (com timeout). Assume que o local já está no ecrã.
 */
export async function enhanceMentorAgendaBriefing(
  local: MentorAgentBriefing,
): Promise<MentorAgentBriefing> {
  const { mentor } = await requireMentor();

  try {
    const remote = await Promise.race([
      agentBriefing(mentor.id, mentor.full_name ?? "Mentor"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("agent briefing timeout")), 2500),
      ),
    ]);
    if (remote.briefing?.trim()) {
      return {
        ...local,
        briefing: remote.briefing.trim(),
        source: remote.model || "LangGraph Agent",
        local: false,
        generatedAt: new Date().toISOString(),
      };
    }
  } catch (e) {
    console.info(
      "agent briefing fallback:",
      e instanceof Error ? e.message : e,
    );
  }

  return local;
}

export async function generateMentorAgendaBriefing(): Promise<MentorAgentBriefing> {
  const local = await generateLocalMentorAgendaBriefing();
  return enhanceMentorAgendaBriefing(local);
}

/** Envia lembretes de check-in por email — só depois de confirmação explícita. */
export async function confirmCheckInNudges(studentIds: string[]) {
  const { supabase, mentor } = await requireMentor();
  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) throw new Error("Sem alunos seleccionados");

  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "student")
    .in("id", unique);

  let sent = 0;
  for (const s of students ?? []) {
    if (!s.email) continue;
    await sendEmail({
      to: s.email,
      subject: "Lembrete: tens um check-in à espera na Neuma",
      html: `<p>Olá${s.full_name ? ` ${s.full_name}` : ""},</p>
<p>${mentor.full_name ?? "O teu mentor"} lembrou-te de fazer o check-in do nível actual.</p>
<p><a href="${appUrl("/checkins")}">Abrir check-ins na Neuma</a></p>`,
    });
    sent += 1;
  }

  return { sent };
}
