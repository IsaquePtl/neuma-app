-- Testes do modulo financeiro (migracao 0035_billing.sql).
--
-- Como correr, num Postgres local descartavel:
--
--   createdb neuma_test
--   psql -v ON_ERROR_STOP=1 -d neuma_test -f supabase/tests/00_supabase_stub.sql
--   for f in supabase/migrations/*.sql; do psql -d neuma_test -f "$f"; done
--   psql -d neuma_test -f supabase/tests/01_billing_access.sql
--
-- Nota: os testes de RLS e do trigger TEM de correr dentro de transaccoes.
-- Fora de uma transaccao, "set local role" nao tem efeito e tudo corre como
-- superutilizador, que ignora RLS e e permitido pelo trigger. Um teste assim
-- passa sempre e nao prova nada.

\set ON_ERROR_STOP on
\pset pager off

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'mentor@neuma.pt'),
  ('22222222-2222-2222-2222-222222222222', 'antigo@aluno.pt'),
  ('33333333-3333-3333-3333-333333333333', 'novo@aluno.pt'),
  ('44444444-4444-4444-4444-444444444444', 'pagante@aluno.pt')
on conflict do nothing;

update public.profiles set role = 'mentor'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set created_at = '2026-01-01'
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set created_at = '2026-12-01'
  where id in ('33333333-3333-3333-3333-333333333333',
               '44444444-4444-4444-4444-444444444444');

-- =====================================================================
-- ACESSO
-- =====================================================================

\echo '=== 1. Paywall desligado (estado de producao): todos com acesso ==='
select p.email, public.has_app_access(p.id) as tem_acesso
from public.profiles p order by p.email;

\echo ''
\echo '=== 2. Cutoff activo: grandfather protege quem ja existia ==='
update public.finance_settings
  set value = to_jsonb('2026-06-01T00:00:00Z'::text) where key = 'paywall_start_at';
select p.email, p.created_at::date as criado, public.has_app_access(p.id) as tem_acesso
from public.profiles p order by p.email;
\echo 'Esperado: mentor t (nunca bloqueado), antigo t, novo f, pagante f.'

\echo ''
\echo '=== 3. Subscricao activa da acesso ==='
insert into public.subscriptions
  (profile_id, stripe_subscription_id, plan, status, unit_amount, interval, interval_count)
values ('44444444-4444-4444-4444-444444444444', 'sub_test_active', 'monthly', 'active', 2494, 'month', 1)
on conflict (stripe_subscription_id) do nothing;
select p.email, public.has_app_access(p.id) as tem_acesso from public.profiles p
where p.email in ('novo@aluno.pt', 'pagante@aluno.pt') order by p.email;
\echo 'Esperado: novo f, pagante t.'

\echo ''
\echo '=== 4. past_due dentro e fora da tolerancia de 7 dias ==='
update public.subscriptions set status = 'past_due', past_due_since = now() - interval '3 days'
  where stripe_subscription_id = 'sub_test_active';
select 'past_due ha 3 dias' as cenario,
       public.has_app_access('44444444-4444-4444-4444-444444444444') as tem_acesso;
update public.subscriptions set past_due_since = now() - interval '30 days'
  where stripe_subscription_id = 'sub_test_active';
select 'past_due ha 30 dias' as cenario,
       public.has_app_access('44444444-4444-4444-4444-444444444444') as tem_acesso;
\echo 'Esperado: t depois f.'

-- =====================================================================
-- SEGURANCA: o trigger que protege role / billing_exempt / is_one_to_one
-- =====================================================================

update public.profiles set billing_exempt = false, is_one_to_one = false;

\echo ''
\echo '=== 5. Aluno nao consegue escrever nas colunas protegidas ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  do $$
  declare passou int := 0; bloqueadas int := 0;
  begin
    begin update public.profiles set billing_exempt = true where id = auth.uid();
      passou := passou+1; raise warning 'FALHA: billing_exempt';
    exception when others then bloqueadas := bloqueadas+1; end;
    begin update public.profiles set role = 'mentor' where id = auth.uid();
      passou := passou+1; raise warning 'FALHA: role';
    exception when others then bloqueadas := bloqueadas+1; end;
    begin update public.profiles set is_one_to_one = true where id = auth.uid();
      passou := passou+1; raise warning 'FALHA: is_one_to_one';
    exception when others then bloqueadas := bloqueadas+1; end;
    raise notice 'bloqueadas=% passaram=%  (esperado 3 / 0)', bloqueadas, passou;
  end $$;
rollback;

\echo ''
\echo '=== 6. Nem escondido dentro de uma edicao legitima de perfil ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  do $$
  begin
    update public.profiles set full_name = 'X', billing_exempt = true where id = auth.uid();
    raise warning 'FALHA: passou escondido num update combinado';
  exception when others then raise notice 'OK: bloqueado tambem em update combinado'; end $$;
rollback;

\echo ''
\echo '=== 7. Nao regressao: aluno continua a editar nome, bio e redes ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  do $$
  begin
    update public.profiles set full_name = 'Nome Novo', bio = 'ola', instagram = 'x'
      where id = auth.uid();
    raise notice 'OK: edicao normal do perfil funciona';
  exception when others then raise warning 'REGRESSAO: %', sqlerrm; end $$;
rollback;

\echo ''
\echo '=== 8. Mentor e service_role podem gerir as colunas protegidas ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  begin
    update public.profiles set billing_exempt = true
      where id = '33333333-3333-3333-3333-333333333333';
    raise notice 'OK: mentor deu cortesia';
  exception when others then raise warning 'PROBLEMA: mentor bloqueado: %', sqlerrm; end $$;
rollback;

begin;
  set local role service_role;
  do $$
  begin
    update public.profiles set is_one_to_one = true
      where id = '33333333-3333-3333-3333-333333333333';
    raise notice 'OK: service_role escreveu (webhook 1:1 funciona)';
  exception when others then raise warning 'PROBLEMA: service_role bloqueado: %', sqlerrm; end $$;
rollback;

-- =====================================================================
-- RLS
-- =====================================================================

insert into public.subscriptions
  (profile_id, stripe_subscription_id, plan, status, unit_amount, interval)
values ('22222222-2222-2222-2222-222222222222', 'sub_de_outro', 'annual', 'active', 19894, 'year')
on conflict (stripe_subscription_id) do nothing;

\echo ''
\echo '=== 9. Aluno so ve a propria subscricao ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
  select count(*) as subscricoes_visiveis from public.subscriptions;
rollback;
\echo 'Esperado: 1 (existem 2 na tabela).'

\echo ''
\echo '=== 10. Aluno nao ve dados administrativos ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
  select 'stripe_events' as tabela, count(*) as visiveis from public.stripe_events
  union all select 'one_to_one_invites',  count(*) from public.one_to_one_invites
  union all select 'finance_settings',    count(*) from public.finance_settings
  union all select 'subscription_events', count(*) from public.subscription_events;
rollback;
\echo 'Esperado: 0 em todas.'

\echo ''
\echo '=== 11. Aluno nao consegue alterar a propria subscricao ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
  do $$
  declare n int;
  begin
    update public.subscriptions set status = 'active' where profile_id = auth.uid();
    get diagnostics n = row_count;
    if n > 0 then raise warning 'FALHA: aluno alterou a subscricao';
    else raise notice 'OK: bloqueado por RLS, 0 linhas'; end if;
  exception when others then raise notice 'OK: bloqueado: %', sqlerrm; end $$;
rollback;

\echo ''
\echo '=== 12. Repor o estado de producao ==='
update public.finance_settings set value = 'null'::jsonb where key = 'paywall_start_at';
select count(*) filter (where public.has_app_access(id)) as com_acesso, count(*) as total
from public.profiles;
\echo 'Esperado: com_acesso = total.'
