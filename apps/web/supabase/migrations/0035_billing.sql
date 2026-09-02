-- Neuma - Modulo financeiro (Stripe)
--
-- Esta migracao e ADITIVA e IDEMPOTENTE. Pode correr numa base de dados
-- partilhada com producao sem alterar o comportamento da app que ja la esta:
--
--   * nao apaga nem altera nenhuma coluna existente;
--   * as tabelas novas nascem vazias;
--   * o grandfather e feito por CUTOFF TEMPORAL (finance_settings.paywall_start_at).
--     Enquanto essa chave for null, has_app_access() devolve true para toda a
--     gente, por isso nenhum login actual e afectado, hoje ou no futuro;
--   * a unica alteracao de comportamento numa tabela viva e o trigger que
--     impede um aluno de escrever em role / billing_exempt / is_one_to_one.
--     Isso fecha um buraco que ja existe hoje (ver seccao 6).
--
-- Correr uma vez no SQL Editor do Supabase. Correr duas vezes nao faz mal.

-- =====================================================================
-- 1. ENUMS
-- =====================================================================

do $$ begin
  create type public.billing_plan as enum ('monthly', 'quarterly', 'annual', 'one_to_one');
exception when duplicate_object then null;
end $$;

-- Espelha os estados da Stripe, um para um.
do $$ begin
  create type public.subscription_status as enum (
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.one_to_one_invite_status as enum (
    'pending', 'sent', 'paid', 'expired', 'revoked'
  );
exception when duplicate_object then null;
end $$;

-- =====================================================================
-- 2. COLUNAS NOVAS EM PROFILES
-- =====================================================================
-- billing_exempt = cortesia manual, ligada pelo mentor no modulo Financas.
-- NAO e o mecanismo de grandfather (esse e o cutoff temporal).

alter table public.profiles
  add column if not exists billing_exempt boolean not null default false,
  add column if not exists is_one_to_one  boolean not null default false;

-- =====================================================================
-- 3. FUNCAO AUXILIAR: updated_at
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =====================================================================
-- 4. TABELAS
-- =====================================================================

-- finance_settings: configuracao chave/valor do modulo financeiro.
-- Guarda o cutoff do paywall e as metas do dashboard.
create table if not exists public.finance_settings (
  key        text primary key,
  value      jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- Cutoff do paywall. NULL = ninguem e bloqueado (estado actual e desejado
-- em producao). Definir uma data activa o paywall so para contas criadas
-- depois dela.
insert into public.finance_settings (key, value)
values
  ('paywall_start_at',    'null'::jsonb),
  ('past_due_grace_days', '7'::jsonb),
  ('mrr_goal_cents',      'null'::jsonb)
on conflict (key) do nothing;

-- billing_customers: liga um perfil ao cliente Stripe.
create table if not exists public.billing_customers (
  profile_id         uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  email              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- subscriptions: espelho do estado na Stripe. Fonte de verdade e sempre a
-- Stripe; esta tabela e um cache consultavel.
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  profile_id             uuid references public.profiles(id) on delete set null,
  -- Snapshot para o historico sobreviver a remocao do aluno.
  student_name           text,
  student_email          text,

  stripe_customer_id     text,
  stripe_subscription_id text not null unique,
  stripe_price_id        text,
  -- Necessario para mudar de plano: subscriptions.update precisa do id do item.
  stripe_item_id         text,

  plan                   public.billing_plan,
  status                 public.subscription_status not null,
  currency               text not null default 'eur',
  unit_amount            integer,
  interval               text,
  interval_count         integer not null default 1,

  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  canceled_at            timestamptz,
  ended_at               timestamptz,
  trial_end              timestamptz,
  -- pause_collection chega dentro de customer.subscription.updated,
  -- nao existe evento "paused" proprio.
  collection_paused      boolean not null default false,
  paused_at              timestamptz,
  -- Inicio da janela de tolerancia quando entra em past_due.
  past_due_since         timestamptz,

  card_brand             text,
  card_last4             text,
  latest_invoice_id      text,

  -- Protecao contra eventos fora de ordem: so aplicamos um evento se for
  -- mais recente do que o ultimo que ja processamos para esta subscricao.
  stripe_event_at        timestamptz,
  raw                    jsonb,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_profile_idx  on public.subscriptions (profile_id);
create index if not exists subscriptions_status_idx   on public.subscriptions (status);
create index if not exists subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

-- payments: uma linha por factura paga. Alimenta a receita do dashboard.
-- on delete set null + snapshot para nao perder historico ao apagar um aluno.
create table if not exists public.payments (
  id                       uuid primary key default gen_random_uuid(),
  profile_id               uuid references public.profiles(id) on delete set null,
  subscription_id          uuid references public.subscriptions(id) on delete set null,
  student_name             text,
  student_email            text,

  stripe_invoice_id        text unique,
  stripe_payment_intent_id text,
  stripe_charge_id         text,
  stripe_customer_id       text,

  plan                     public.billing_plan,
  amount_cents             integer not null default 0,
  amount_refunded_cents    integer not null default 0,
  currency                 text not null default 'eur',
  status                   text,
  description              text,
  hosted_invoice_url       text,
  invoice_pdf              text,

  paid_at                  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists payments_profile_idx on public.payments (profile_id);
create index if not exists payments_paid_at_idx on public.payments (paid_at desc);

-- refunds: reembolsos, atribuidos a data do reembolso (nao a do pagamento).
create table if not exists public.refunds (
  id               uuid primary key default gen_random_uuid(),
  payment_id       uuid references public.payments(id) on delete set null,
  profile_id       uuid references public.profiles(id) on delete set null,
  stripe_refund_id text not null unique,
  amount_cents     integer not null,
  currency         text not null default 'eur',
  reason           text,
  created_by       uuid references public.profiles(id) on delete set null,
  refunded_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists refunds_refunded_at_idx on public.refunds (refunded_at desc);

-- subscription_events: auditoria de tudo o que o admin faz.
create table if not exists public.subscription_events (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  profile_id      uuid references public.profiles(id) on delete set null,
  actor_id        uuid references public.profiles(id) on delete set null,
  action          text not null,
  detail          jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists subscription_events_sub_idx on public.subscription_events (subscription_id, created_at desc);

-- stripe_events: idempotencia dos webhooks. PK = id do evento Stripe.
create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  api_version  text,
  payload      jsonb,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text
);

create index if not exists stripe_events_type_idx on public.stripe_events (type, received_at desc);

-- one_to_one_invites: convites Neuma 1:1 com preco a medida.
-- O token nunca e guardado em claro; guardamos sha256(token).
create table if not exists public.one_to_one_invites (
  id                         uuid primary key default gen_random_uuid(),
  email                      text not null,
  full_name                  text,
  token_hash                 text not null unique,

  amount_cents               integer not null,
  currency                   text not null default 'eur',
  interval                   text not null default 'month',
  interval_count             integer not null default 1,

  stripe_price_id            text,
  stripe_checkout_session_id text,

  status                     public.one_to_one_invite_status not null default 'pending',
  notes                      text,
  source_submission_id       uuid,

  created_by                 uuid references public.profiles(id) on delete set null,
  expires_at                 timestamptz,
  redeemed_profile_id        uuid references public.profiles(id) on delete set null,
  redeemed_at                timestamptz,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists one_to_one_invites_status_idx on public.one_to_one_invites (status, created_at desc);
create index if not exists one_to_one_invites_email_idx  on public.one_to_one_invites (lower(email));

-- Triggers de updated_at
do $$
declare
  t text;
begin
  foreach t in array array[
    'finance_settings', 'billing_customers', 'subscriptions',
    'payments', 'one_to_one_invites'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- =====================================================================
-- 5. has_app_access()
-- =====================================================================
-- Razoes independentes para ter acesso:
--   1. ser mentor (a equipa nunca e bloqueada)
--   2. cortesia manual (billing_exempt)
--   3. conta criada antes do cutoff, ou cutoff por definir (grandfather)
--   4. subscricao valida
--
-- Com paywall_start_at a null, a razao 3 e sempre verdadeira e a funcao
-- devolve true para todos. E isso que garante que producao nao muda.

create or replace function public.has_app_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p.role = 'mentor'
    or coalesce(p.billing_exempt, false)
    or c.cutoff is null
    or p.created_at < c.cutoff
    or exists (
      select 1
      from public.subscriptions s
      where s.profile_id = p.id
        and (
          s.status in ('active', 'trialing')
          or (
            s.status = 'past_due'
            and coalesce(s.past_due_since, now()) > now() - make_interval(days => c.grace_days)
          )
        )
    )
  from public.profiles p
  cross join lateral (
    select
      (select nullif(value #>> '{}', '')::timestamptz
         from public.finance_settings where key = 'paywall_start_at') as cutoff,
      coalesce(
        (select nullif(value #>> '{}', '')::int
           from public.finance_settings where key = 'past_due_grace_days'),
        7
      ) as grace_days
  ) c
  where p.id = uid;
$$;

-- =====================================================================
-- 6. FECHAR O BURACO DO profiles_update_own
-- =====================================================================
-- A politica "profiles_update_own" de 0001_init.sql e:
--     for update using (id = auth.uid()) with check (id = auth.uid())
-- Sem restricao de colunas. Ou seja, hoje qualquer aluno pode, com a chave
-- anonima que esta no browser dele, fazer:
--     update profiles set role = 'mentor' where id = auth.uid();
-- e entrar no Studio. Com o paywall, poderia tambem dar-se billing_exempt.
--
-- Nenhum caminho de codigo com sessao de aluno escreve nestas colunas
-- (verificado em lib/actions/profile.ts), por isso o trigger nao parte nada.

-- NOTA IMPORTANTE: esta funcao e SECURITY INVOKER de proposito.
-- Numa funcao SECURITY DEFINER, current_user passa a ser o DONO da funcao
-- (postgres) e nao quem a invoca, o que faria qualquer verificacao baseada
-- em current_user deixar passar toda a gente. Como INVOKER, current_user e
-- o papel real da sessao: 'authenticated' para um aluno, 'service_role'
-- para o admin client, 'postgres' para ligacoes directas.
-- A leitura de profiles feita por is_mentor() continua a funcionar porque
-- essa sim e SECURITY DEFINER.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Nada mudou nas colunas sensiveis: deixa passar.
  if new.role                is not distinct from old.role
     and new.billing_exempt  is not distinct from old.billing_exempt
     and new.is_one_to_one   is not distinct from old.is_one_to_one then
    return new;
  end if;

  -- So as sessoes de utilizador final do PostgREST sao restringidas.
  -- service_role (webhooks, admin client), postgres e os papeis internos
  -- do Supabase passam sempre.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  -- O mentor gere cortesias e promove contas a partir do Studio.
  if public.is_mentor() then
    return new;
  end if;

  raise exception
    'Sem permissao para alterar role, billing_exempt ou is_one_to_one'
    using errcode = '42501';
end;
$$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- =====================================================================
-- 7. RLS
-- =====================================================================
-- Padrao do repositorio: is_mentor() faz tudo, aluno ve apenas o que e dele.
-- Nenhuma tabela permite escrita ao aluno: quem escreve e o service role.

alter table public.finance_settings    enable row level security;
alter table public.billing_customers   enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.payments            enable row level security;
alter table public.refunds             enable row level security;
alter table public.subscription_events enable row level security;
alter table public.stripe_events       enable row level security;
alter table public.one_to_one_invites  enable row level security;

-- Aluno le as proprias linhas (precisa disto em /settings).
drop policy if exists subscriptions_student_select on public.subscriptions;
create policy subscriptions_student_select on public.subscriptions
  for select using (profile_id = auth.uid());

drop policy if exists payments_student_select on public.payments;
create policy payments_student_select on public.payments
  for select using (profile_id = auth.uid());

drop policy if exists refunds_student_select on public.refunds;
create policy refunds_student_select on public.refunds
  for select using (profile_id = auth.uid());

drop policy if exists billing_customers_student_select on public.billing_customers;
create policy billing_customers_student_select on public.billing_customers
  for select using (profile_id = auth.uid());

-- Mentor faz tudo em todas as tabelas do modulo.
do $$
declare
  t text;
begin
  foreach t in array array[
    'finance_settings', 'billing_customers', 'subscriptions', 'payments',
    'refunds', 'subscription_events', 'stripe_events', 'one_to_one_invites'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_mentor_all', t);
    execute format(
      'create policy %I on public.%I for all
         using (public.is_mentor()) with check (public.is_mentor())',
      t || '_mentor_all', t);
  end loop;
end $$;

-- =====================================================================
-- 8. REALTIME
-- =====================================================================
-- Para a lista de subscricoes no Studio actualizar sozinha.
-- replica identity full para o evento de update trazer tambem o registo antigo.

alter table public.subscriptions replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'subscriptions'
  ) then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
exception when undefined_object then
  raise notice 'publicacao supabase_realtime inexistente - activar em Database > Publications';
end $$;
