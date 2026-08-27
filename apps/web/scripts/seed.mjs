// Popula dados de exemplo (Edu) + formulario de onboarding.
// Requer a migration 0002 aplicada. Usa a service role key (ignora RLS).
// Correr: node --env-file=.env.local scripts/seed.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secret) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureUser({ email, password, full_name, role, onboarding }) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  let id = created?.user?.id;
  if (error) {
    if (/already/i.test(error.message)) {
      const { data: list } = await admin.auth.admin.listUsers();
      id = list?.users?.find((x) => x.email === email)?.id;
    } else {
      throw error;
    }
  }
  await admin.from("profiles").upsert(
    { id, email, full_name, role, onboarding_completed: onboarding },
    { onConflict: "id" },
  );
  return id;
}

// 1) Utilizadores
const mentorId = await ensureUser({
  email: "isaqueportilho2014@gmail.com",
  password: "neuma123",
  full_name: "Isaque Portilho",
  role: "mentor",
  onboarding: true,
});
const eduId = await ensureUser({
  email: "edu@neuma.app",
  password: "neuma123",
  full_name: "Edu",
  role: "student",
  onboarding: true,
});
console.log("Utilizadores prontos.");

// 2) Formulario de onboarding (idempotente por titulo)
const ONB_TITLE = "Diagnostico inicial";
const { data: existingForm } = await admin
  .from("forms")
  .select("id")
  .eq("title", ONB_TITLE)
  .maybeSingle();
if (existingForm) await admin.from("forms").delete().eq("id", existingForm.id);

const { data: form } = await admin
  .from("forms")
  .insert({
    created_by: mentorId,
    title: ONB_TITLE,
    description:
      "Conta-me um pouco sobre ti para prepararmos a nossa primeira call.",
    is_onboarding: true,
    is_active: true,
  })
  .select("id")
  .single();

const questions = [
  { label: "Que instrumento queres desenvolver?", type: "short_text", required: true },
  {
    label: "Ha quanto tempo tocas?",
    type: "single_choice",
    options: ["Estou a comecar", "Menos de 1 ano", "1 a 3 anos", "Mais de 3 anos"],
    required: true,
  },
  { label: "Qual e o teu grande objetivo?", type: "long_text", required: true },
  {
    label: "Quanto tempo consegues praticar por semana?",
    type: "single_choice",
    options: ["Menos de 1h", "1 a 3h", "3 a 6h", "Mais de 6h"],
    required: false,
  },
  { label: "Como avalias o teu nivel atual? (1-5)", type: "scale", required: true },
];
await admin.from("form_questions").insert(
  questions.map((q, i) => ({
    form_id: form.id,
    order_index: i,
    label: q.label,
    type: q.type,
    options: q.options ?? null,
    required: q.required,
  })),
);
console.log("Formulario de onboarding criado.");

// 3) Percurso do Edu (recria do zero para ser deterministico)
const { data: oldPaths } = await admin
  .from("paths")
  .select("id")
  .eq("student_id", eduId);
if (oldPaths?.length) {
  await admin.from("paths").delete().eq("student_id", eduId);
}

const today = new Date();
const end = new Date();
end.setMonth(end.getMonth() + 6);
const iso = (d) => d.toISOString().slice(0, 10);

const { data: path } = await admin
  .from("paths")
  .insert({
    student_id: eduId,
    created_by: mentorId,
    title: "Teclado - dos fundamentos a improvisar",
    goal:
      "Em 6 meses, dominar acordes, progressoes e tocar as tuas primeiras musicas com fluidez, ate improvisar sobre uma base.",
    duration_label: "6 meses",
    start_date: iso(today),
    end_date: iso(end),
    status: "active",
  })
  .select("id")
  .single();

const nodes = [
  { title: "Postura, mao e mapa do teclado", kind: "practice", status: "completed", description: "Numeracao dos dedos, postura e localizar notas." },
  { title: "Acordes maiores e menores", kind: "practice", status: "completed", description: "Formar e trocar entre triades com fluidez." },
  { title: "Progressoes I-V-vi-IV", kind: "practice", status: "active", description: "A progressao mais usada na musica pop. Toca-a em 3 tonalidades." },
  { title: "Ritmos de mao esquerda", kind: "practice", status: "locked", description: "Baixo + acorde, padroes ritmicos." },
  { title: "Primeira musica completa", kind: "milestone", status: "locked", description: "Juntar tudo numa musica a tua escolha." },
  { title: "Call de avaliacao intermedia", kind: "call", status: "locked", description: "Revisao em direto e ajuste do plano." },
];
await admin.from("nodes").insert(
  nodes.map((n, i) => ({
    path_id: path.id,
    order_index: i,
    week_number: i + 1,
    title: n.title,
    description: n.description,
    kind: n.kind,
    status: n.status,
  })),
);

const { data: insertedNodes } = await admin
  .from("nodes")
  .select("id, order_index, status")
  .eq("path_id", path.id)
  .order("order_index", { ascending: true });

const node2 = insertedNodes.find((n) => n.order_index === 1);
const node3 = insertedNodes.find((n) => n.order_index === 2);

// 4) Check-in aprovado (semana 2) + feedback
const { data: ci2 } = await admin
  .from("check_ins")
  .insert({
    node_id: node2.id,
    student_id: eduId,
    kind: "video",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    notes: "Consegui trocar entre Do, Sol e Lam sem parar. Fa ainda me atrapalha.",
    status: "approved",
  })
  .select("id")
  .single();
await admin.from("feedbacks").insert({
  check_in_id: ci2.id,
  mentor_id: mentorId,
  notes: "Muito bom progresso! A troca esta limpa. Trabalha o Fa com o polegar mais relaxado.",
  next_steps: "Pratica a progressao I-V-vi-IV 10 min por dia, com metronomo a 70 BPM.",
  approved: true,
});

// 5) Check-in pendente (semana 3) -> aparece na inbox do mentor
await admin.from("check_ins").insert({
  node_id: node3.id,
  student_id: eduId,
  kind: "video",
  video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  notes: "Aqui esta a progressao em Do. Tentei tambem em Sol mas troquei-me algumas vezes.",
  status: "pending",
});

console.log("Percurso do Edu + check-ins criados.");
console.log("\nSeed concluido.");
