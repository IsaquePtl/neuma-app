// Cria a conta de mentor + 1 aluno de teste usando a secret key (admin API).
// Correr com: node --env-file=.env.local scripts/setup-users.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secret) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  {
    email: "isaqueportilho2014@gmail.com",
    password: "neuma123",
    full_name: "Isaque Portilho",
    role: "mentor",
  },
  {
    email: "aluno.teste@neuma.app",
    password: "neuma123",
    full_name: "Aluno de Teste",
    role: "student",
  },
];

for (const u of users) {
  // Cria (ou reaproveita) o utilizador ja confirmado
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
  });

  let userId = created?.user?.id;

  if (createErr) {
    if (/already/i.test(createErr.message)) {
      // Ja existe: procura o id
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list?.users?.find((x) => x.email === u.email)?.id;
      console.log(`= ${u.email}: ja existia`);
    } else {
      console.error(`x ${u.email}:`, createErr.message);
      continue;
    }
  } else {
    console.log(`+ ${u.email}: criado`);
  }

  if (!userId) {
    console.error(`x ${u.email}: sem id, salto`);
    continue;
  }

  // Garante o profile com role e nome corretos (upsert)
  const { error: profErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        onboarding_completed: u.role === "mentor",
      },
      { onConflict: "id" },
    );

  if (profErr) console.error(`x profile ${u.email}:`, profErr.message);
  else console.log(`  profile -> role=${u.role}`);
}

console.log("\nFeito.");
