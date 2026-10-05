-- Signup incompleto: leads de marketing (sem aluno) + flag OAuth.

do $$ begin
  create type public.signup_lead_status as enum (
    'pending_payment',
    'converted',
    'abandoned'
  );
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists signup_incomplete boolean not null default false;

create table if not exists public.signup_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text not null,
  last_name text not null,
  full_name text not null,
  age integer not null check (age >= 13 and age <= 120),
  gender public.profile_gender not null,
  resume_token text not null,
  status public.signup_lead_status not null default 'pending_payment',
  selected_plan public.billing_plan,
  stripe_checkout_session_id text,
  converted_profile_id uuid references public.profiles(id) on delete set null,
  resume_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signup_leads_email_unique unique (email),
  constraint signup_leads_resume_token_unique unique (resume_token)
);

create index if not exists signup_leads_status_idx
  on public.signup_leads (status);

create index if not exists signup_leads_converted_profile_idx
  on public.signup_leads (converted_profile_id)
  where converted_profile_id is not null;

drop trigger if exists signup_leads_set_updated_at on public.signup_leads;
create trigger signup_leads_set_updated_at
  before update on public.signup_leads
  for each row execute function public.set_updated_at();

alter table public.signup_leads enable row level security;

-- Sem policies: acesso só via service role (server actions / webhooks).

comment on table public.signup_leads is
  'Leads de signup incompleto (passo 1 sem pagamento). Não são alunos.';

comment on column public.profiles.signup_incomplete is
  'OAuth/signup a meio: não contar como aluno activo nem enviar para /subscrever.';
