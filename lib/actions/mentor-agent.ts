"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { appUrl, sendEmail } from "@/lib/email";
import {
  generateObjectCascade,
  hasAnyAiKey,
} from "@/lib/ai/model-cascade";

const suggestionSchema = z.object({
  briefing: z
    .string()
    .describe(
      "Resumo curto (2-4 frases) do que mais importa agora para o mentor",
    ),
  items: z
    .array(
      z.object({
        kind: z.enum([
          "call_prep",
          "checkin_nudge",
          "review",
          "insight",
          "other",
        ]),
        priority: z.enum(["high", "medium", "low"]),
        title: z.string(),
        body: z
          .string()
          .describe(
            "Conteúdo útil: roteiro de call, lista, mensagem pronta, insight",
          ),
        actionType: z
          .enum([
            "none",
            "open_checkin",
            "open_student",
            "open_calendar",
            "nudge_checkins",
          ])
          .default("none"),
        actionLabel: z.string().nullable().optional(),
        studentIds: z.array(z.string()).optional().default([]),
        checkInId: z.string().nullable().optional(),
      }),
    )
    .max(6),
});

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
    | "nudge_checkins";
  actionLabel: string | null;
  studentIds: string[];
  checkInId: string | null;
  href: string | null;
};

export type MentorAgentBriefing = {
  briefing: string;
  items: MentorAgentSuggestion[];
  generatedAt: string;
  /** Quem gerou: modelo LLM ou "local" */
  source: string;
  /** true = sem custo de API */
  local: boolean;
};

type PendingCheckIn = {
  id: string;
  created_at: string;
  student: string;
  studentId: string;
  node: string;
};

type Upcoming = {
  id: string;
  when: string;
  who: string;
  studentId: string | null;
  title: string;
};

type QuietStudent = { id: string; name: string; days: number };

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

function buildContext(parts: {
  mentorName: string;
  pendingCheckIns: PendingCheckIn[];
  upcoming: Upcoming[];
  quietStudents: QuietStudent[];
  pendingOnboardings: number;
  activePaths: number;
}) {
  const lines: string[] = [];
  lines.push(`Mentor: ${parts.mentorName}`);
  lines.push(`Data/hora agora (ISO): ${new Date().toISOString()}`);
  lines.push(`Onboardings pendentes: ${parts.pendingOnboardings}`);
  lines.push(`Percursos ativos: ${parts.activePaths}`);
  lines.push("");
  lines.push("Check-ins por avaliar:");
  if (parts.pendingCheckIns.length === 0) lines.push("- (nenhum)");
  else {
    for (const c of parts.pendingCheckIns) {
      lines.push(
        `- id=${c.id} · aluno=${c.student} (${c.studentId}) · bloco=${c.node} · desde=${c.created_at}`,
      );
    }
  }
  lines.push("");
  lines.push("Próximas sessões Cal.com:");
  if (parts.upcoming.length === 0) lines.push("- (nenhuma)");
  else {
    for (const u of parts.upcoming) {
      lines.push(
        `- id=${u.id} · ${u.when} · ${u.who} · student_id=${u.studentId ?? "null"} · ${u.title}`,
      );
    }
  }
  lines.push("");
  lines.push("Alunos sem check-in recente (ativos):");
  if (parts.quietStudents.length === 0) lines.push("- (nenhum sinal claro)");
  else {
    for (const s of parts.quietStudents) {
      lines.push(`- id=${s.id} · ${s.name} · ~${s.days} dias sem check-in`);
    }
  }
  return lines.join("\n");
}

function mapItems(
  items: z.infer<typeof suggestionSchema>["items"],
): MentorAgentSuggestion[] {
  return items.map((item) => {
    let href: string | null = null;
    if (item.actionType === "open_checkin" && item.checkInId) {
      href = `/studio/checkins/${item.checkInId}?from=dashboard`;
    } else if (item.actionType === "open_student" && item.studentIds?.[0]) {
      href = `/studio/students/${item.studentIds[0]}`;
    } else if (item.actionType === "open_calendar") {
      href = "/studio/calendar";
    }

    return {
      kind: item.kind,
      priority: item.priority,
      title: item.title,
      body: item.body,
      actionType: item.actionType,
      actionLabel: item.actionLabel ?? null,
      studentIds: item.studentIds ?? [],
      checkInId: item.checkInId ?? null,
      href,
    };
  });
}

/** Briefing a custo 0 — só dados reais, sem LLM. */
function buildLocalBriefing(parts: {
  pendingCheckIns: PendingCheckIn[];
  upcoming: Upcoming[];
  quietStudents: QuietStudent[];
  pendingOnboardings: number;
  activePaths: number;
}): MentorAgentBriefing {
  const items: MentorAgentSuggestion[] = [];

  for (const u of parts.upcoming.slice(0, 2)) {
    items.push({
      kind: "call_prep",
      priority: "high",
      title: `Preparar call · ${u.who}`,
      body: [
        `Sessão: ${u.title}`,
        `Quando: ${u.when}`,
        "",
        "Roteiro rápido:",
        "1. Abrir com o que correu bem desde a última vez",
        "2. Rever o nível actual e o último check-in / feedback",
        "3. Definir 1 objectivo concreto até à próxima sessão",
        "4. Acordar próximo passo no percurso (avançar vs. mais tempo)",
      ].join("\n"),
      actionType: u.studentId ? "open_student" : "open_calendar",
      actionLabel: u.studentId ? "Abrir ficha" : "Abrir calendário",
      studentIds: u.studentId ? [u.studentId] : [],
      checkInId: null,
      href: u.studentId
        ? `/studio/students/${u.studentId}`
        : "/studio/calendar",
    });
  }

  for (const c of parts.pendingCheckIns.slice(0, 3)) {
    items.push({
      kind: "review",
      priority: "high",
      title: `Avaliar · ${c.student}`,
      body: `Check-in pendente no bloco «${c.node}». Responde com feedback e decide se avanças ou prolongas o nível.`,
      actionType: "open_checkin",
      actionLabel: "Avaliar",
      studentIds: [c.studentId],
      checkInId: c.id,
      href: `/studio/checkins/${c.id}?from=dashboard`,
    });
  }

  if (parts.quietStudents.length > 0) {
    const top = parts.quietStudents.slice(0, 5);
    items.push({
      kind: "checkin_nudge",
      priority: "medium",
      title: `${top.length} aluno(s) sem check-in recente`,
      body: top
        .map((s) => `· ${s.name} (~${s.days} dias)`)
        .join("\n"),
      actionType: "nudge_checkins",
      actionLabel: "Confirmar envio de lembretes",
      studentIds: top.map((s) => s.id),
      checkInId: null,
      href: null,
    });
  }

  if (parts.pendingOnboardings > 0) {
    items.push({
      kind: "insight",
      priority: "medium",
      title: `${parts.pendingOnboardings} onboarding(s) por tratar`,
      body: "Há respostas de intake à espera. Trata-as em Percursos → Onboardings para não atrasar o arranque.",
      actionType: "none",
      actionLabel: null,
      studentIds: [],
      checkInId: null,
      href: "/studio/journeys/onboardings",
    });
  }

  const bits: string[] = [];
  if (parts.upcoming.length > 0) {
    bits.push(
      `${parts.upcoming.length} sessão(ões) à frente (próxima: ${parts.upcoming[0].who}).`,
    );
  }
  if (parts.pendingCheckIns.length > 0) {
    bits.push(`${parts.pendingCheckIns.length} check-in(s) por avaliar.`);
  } else {
    bits.push("Sem check-ins pendentes.");
  }
  if (parts.quietStudents.length > 0) {
    bits.push(
      `${parts.quietStudents.length} aluno(s) quietos há ≥7 dias.`,
    );
  }
  bits.push(`${parts.activePaths} percurso(s) ativo(s).`);

  return {
    briefing: bits.join(" "),
    items: items.slice(0, 6),
    generatedAt: new Date().toISOString(),
    source: "Local (custo 0)",
    local: true,
  };
}

async function loadAgendaContext() {
  const { supabase, mentor } = await requireMentor();
  const nowIso = new Date().toISOString();
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [
    { data: pending },
    { data: upcoming },
    { count: onboardingCount },
    { count: activePaths },
    { data: students },
    { data: recentCheckIns },
  ] = await Promise.all([
    supabase
      .from("check_ins")
      .select(
        "id, created_at, student_id, student:profiles!check_ins_student_id_fkey(full_name, email), node:nodes(title)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(12),
    supabase
      .from("cal_bookings")
      .select(
        "id, start_time, title, attendee_name, attendee_email, student_id",
      )
      .in("status", ["accepted", "pending", "rescheduled"])
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(6),
    supabase
      .from("tally_submissions")
      .select("id", { count: "exact", head: true })
      .eq("submission_kind", "onboarding")
      .eq("status", "pending"),
    supabase
      .from("paths")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "student"),
    supabase
      .from("check_ins")
      .select("student_id, created_at")
      .gte("created_at", fourteenDaysAgo.toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const lastCheckInByStudent = new Map<string, string>();
  for (const row of recentCheckIns ?? []) {
    if (!lastCheckInByStudent.has(row.student_id)) {
      lastCheckInByStudent.set(row.student_id, row.created_at);
    }
  }

  const quietStudents = (students ?? [])
    .map((s) => {
      const last = lastCheckInByStudent.get(s.id);
      const days = last
        ? Math.floor(
            (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24),
          )
        : 99;
      return {
        id: s.id,
        name: s.full_name ?? s.email ?? "Aluno",
        days,
      };
    })
    .filter((s) => s.days >= 7)
    .sort((a, b) => b.days - a.days)
    .slice(0, 8);

  const pendingCheckIns: PendingCheckIn[] = (pending ?? []).map((c) => {
    const student = Array.isArray(c.student) ? c.student[0] : c.student;
    const node = Array.isArray(c.node) ? c.node[0] : c.node;
    return {
      id: c.id,
      created_at: c.created_at,
      studentId: c.student_id,
      student: student?.full_name ?? student?.email ?? "Aluno",
      node: node?.title ?? "Bloco",
    };
  });

  const upcomingMapped: Upcoming[] = (upcoming ?? []).map((b) => ({
    id: b.id,
    when: new Date(b.start_time).toLocaleString("pt-PT", {
      dateStyle: "full",
      timeStyle: "short",
    }),
    who: b.attendee_name ?? b.attendee_email ?? "Convidado",
    studentId: b.student_id,
    title: b.title ?? "Sessão",
  }));

  return {
    mentor,
    pendingCheckIns,
    upcoming: upcomingMapped,
    quietStudents,
    pendingOnboardings: onboardingCount ?? 0,
    activePaths: activePaths ?? 0,
  };
}

export async function generateMentorAgendaBriefing(): Promise<MentorAgentBriefing> {
  const ctx = await loadAgendaContext();
  const local = buildLocalBriefing(ctx);

  if (!hasAnyAiKey()) {
    return local;
  }

  const context = buildContext({
    mentorName: ctx.mentor.full_name ?? "Mentor",
    pendingCheckIns: ctx.pendingCheckIns,
    upcoming: ctx.upcoming,
    quietStudents: ctx.quietStudents,
    pendingOnboardings: ctx.pendingOnboardings,
    activePaths: ctx.activePaths,
  });

  try {
    const { object, source } = await generateObjectCascade({
      schema: suggestionSchema,
      system: `És o AI Agent da Agenda do mentor ${ctx.mentor.full_name ?? "Neuma"}.
Objetivo: poupar tempo e destacar o que realmente importa agora.
Respondes em português de Portugal, directo e útil. Nunca digas que és uma IA.
Nunca inventes alunos, datas ou IDs fora do contexto.
Sugestões devem ser accionáveis; o mentor confirma antes de qualquer envio.
Prioriza: (1) preparação de calls próximas com roteiro concreto, (2) check-ins urgentes, (3) alunos quietos a precisar de nudge, (4) insights curtos.
Para call_prep: inclui roteiro (objectivo, 3 perguntas, o que rever do percurso/feedback).
Para checkin_nudge: lista quem e porque; actionType=nudge_checkins com studentIds.
Para review: aponta check-ins com checkInId real e actionType=open_checkin.
${ctx.mentor.mentor_style_notes ? `Estilo do mentor:\n${ctx.mentor.mentor_style_notes}` : ""}`,
      prompt: `Analisa o contexto e propõe um briefing + até 6 itens prioritários.

Contexto:
${context}`,
    });

    return {
      briefing: object.briefing,
      items: mapItems(object.items),
      generatedAt: new Date().toISOString(),
      source,
      local: false,
    };
  } catch {
    // Free tiers esgotados / erro → fallback local (custo 0)
    return local;
  }
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
