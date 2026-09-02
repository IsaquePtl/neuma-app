-- 0036: RPC do dashboard financeiro (MRR, receita, series, por plano)
--
-- Fonte de verdade continua a ser a Stripe (ver 0035_billing.sql); esta
-- funcao so agrega o espelho local (subscriptions/payments/refunds) para o
-- Studio nao ter de puxar tudo para o Node e agregar a mao.
--
-- SECURITY DEFINER para poder ler as tabelas sem depender da RLS da sessao,
-- mas com o mesmo guarda-de-mentor usado em mentor_dashboard_facts().

create or replace function public.finance_dashboard(
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text default 'day',
  p_tz text default 'Europe/Lisbon'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_from timestamptz := p_from - (p_to - p_from);
  v_prev_to   timestamptz := p_from;
  v_bucket    text := case when p_bucket in ('day', 'week', 'month') then p_bucket else 'day' end;
  v_step      interval := case v_bucket
                             when 'week'  then interval '1 week'
                             when 'month' then interval '1 month'
                             else interval '1 day'
                           end;
  v_current jsonb;
  v_prev    jsonb;
  v_series  jsonb;
  v_by_plan jsonb;
begin
  if not public.is_mentor() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'mrr_cents', round(coalesce(mrr.mrr_cents, 0)),
    'arr_cents', round(coalesce(mrr.mrr_cents, 0) * 12),
    'revenue_cents', coalesce(rev.revenue_cents, 0),
    'refunds_cents', coalesce(ref.refunds_cents, 0),
    'net_revenue_cents', coalesce(rev.revenue_cents, 0) - coalesce(ref.refunds_cents, 0),
    'active_subscribers', coalesce(act.active_subscribers, 0),
    'new_subscriptions', coalesce(newsub.new_subscriptions, 0),
    'cancellations', coalesce(cancel.cancellations, 0),
    'churn_rate', case
      when coalesce(act.active_subscribers, 0) + coalesce(cancel.cancellations, 0) = 0 then 0
      else round(
        coalesce(cancel.cancellations, 0)::numeric
        / (coalesce(act.active_subscribers, 0) + coalesce(cancel.cancellations, 0)) * 100,
        2
      )
    end,
    'avg_ticket_cents', case
      when coalesce(rev.payment_count, 0) = 0 then 0
      else round(coalesce(rev.revenue_cents, 0)::numeric / rev.payment_count)
    end
  )
  into v_current
  from (select 1) dummy
  left join lateral (
    select sum(
      s.unit_amount::numeric /
      case
        when s.interval = 'year' then 12 * greatest(1, s.interval_count)
        when s.interval = 'week' then greatest(1, s.interval_count) * 7 / 30.437
        when s.interval = 'day'  then greatest(1, s.interval_count) / 30.437
        else greatest(1, s.interval_count)
      end
    ) as mrr_cents
    from public.subscriptions s
    where s.status in ('active', 'trialing')
      and not s.collection_paused
      and s.unit_amount is not null
  ) mrr on true
  left join lateral (
    select sum(p.amount_cents) as revenue_cents, count(*) as payment_count
    from public.payments p
    where p.paid_at >= p_from and p.paid_at < p_to
  ) rev on true
  left join lateral (
    select sum(r.amount_cents) as refunds_cents
    from public.refunds r
    where r.refunded_at >= p_from and r.refunded_at < p_to
  ) ref on true
  left join lateral (
    select count(*) as active_subscribers
    from public.subscriptions s
    where s.status in ('active', 'trialing')
  ) act on true
  left join lateral (
    select count(*) as new_subscriptions
    from public.subscriptions s
    where s.created_at >= p_from and s.created_at < p_to
  ) newsub on true
  left join lateral (
    select count(*) as cancellations
    from public.subscriptions s
    where s.canceled_at >= p_from and s.canceled_at < p_to
  ) cancel on true;

  -- Periodo anterior, mesma duracao. A MRR/activos nao tem historico
  -- guardado, por isso aproxima-se pelo estado das subscricoes criadas
  -- antes do fim do periodo anterior — suficiente para a variacao no KPI.
  select jsonb_build_object(
    'mrr_cents', round(coalesce(mrr.mrr_cents, 0)),
    'arr_cents', round(coalesce(mrr.mrr_cents, 0) * 12),
    'revenue_cents', coalesce(rev.revenue_cents, 0),
    'refunds_cents', coalesce(ref.refunds_cents, 0),
    'net_revenue_cents', coalesce(rev.revenue_cents, 0) - coalesce(ref.refunds_cents, 0),
    'active_subscribers', coalesce(act.active_subscribers, 0),
    'new_subscriptions', coalesce(newsub.new_subscriptions, 0),
    'cancellations', coalesce(cancel.cancellations, 0),
    'churn_rate', case
      when coalesce(act.active_subscribers, 0) + coalesce(cancel.cancellations, 0) = 0 then 0
      else round(
        coalesce(cancel.cancellations, 0)::numeric
        / (coalesce(act.active_subscribers, 0) + coalesce(cancel.cancellations, 0)) * 100,
        2
      )
    end,
    'avg_ticket_cents', case
      when coalesce(rev.payment_count, 0) = 0 then 0
      else round(coalesce(rev.revenue_cents, 0)::numeric / rev.payment_count)
    end
  )
  into v_prev
  from (select 1) dummy
  left join lateral (
    select sum(
      s.unit_amount::numeric /
      case
        when s.interval = 'year' then 12 * greatest(1, s.interval_count)
        when s.interval = 'week' then greatest(1, s.interval_count) * 7 / 30.437
        when s.interval = 'day'  then greatest(1, s.interval_count) / 30.437
        else greatest(1, s.interval_count)
      end
    ) as mrr_cents
    from public.subscriptions s
    where s.status in ('active', 'trialing')
      and not s.collection_paused
      and s.unit_amount is not null
      and s.created_at < v_prev_to
  ) mrr on true
  left join lateral (
    select sum(p.amount_cents) as revenue_cents, count(*) as payment_count
    from public.payments p
    where p.paid_at >= v_prev_from and p.paid_at < v_prev_to
  ) rev on true
  left join lateral (
    select sum(r.amount_cents) as refunds_cents
    from public.refunds r
    where r.refunded_at >= v_prev_from and r.refunded_at < v_prev_to
  ) ref on true
  left join lateral (
    select count(*) as active_subscribers
    from public.subscriptions s
    where s.status in ('active', 'trialing')
      and s.created_at < v_prev_to
  ) act on true
  left join lateral (
    select count(*) as new_subscriptions
    from public.subscriptions s
    where s.created_at >= v_prev_from and s.created_at < v_prev_to
  ) newsub on true
  left join lateral (
    select count(*) as cancellations
    from public.subscriptions s
    where s.canceled_at >= v_prev_from and s.canceled_at < v_prev_to
  ) cancel on true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket', to_char(b.bucket_start, 'YYYY-MM-DD'),
    'revenue_cents', coalesce(rs.revenue_cents, 0),
    'refunds_cents', coalesce(rf.refunds_cents, 0),
    'new_subs', coalesce(ns.new_subs, 0),
    'cancellations', coalesce(cs.cancellations, 0)
  ) order by b.bucket_start), '[]'::jsonb)
  into v_series
  from generate_series(
    date_trunc(v_bucket, p_from at time zone p_tz),
    date_trunc(v_bucket, (p_to - interval '1 second') at time zone p_tz),
    v_step
  ) b(bucket_start)
  left join lateral (
    select sum(p.amount_cents) as revenue_cents
    from public.payments p
    where date_trunc(v_bucket, p.paid_at at time zone p_tz) = b.bucket_start
  ) rs on true
  left join lateral (
    select sum(r.amount_cents) as refunds_cents
    from public.refunds r
    where date_trunc(v_bucket, r.refunded_at at time zone p_tz) = b.bucket_start
  ) rf on true
  left join lateral (
    select count(*) as new_subs
    from public.subscriptions s
    where date_trunc(v_bucket, s.created_at at time zone p_tz) = b.bucket_start
  ) ns on true
  left join lateral (
    select count(*) as cancellations
    from public.subscriptions s
    where date_trunc(v_bucket, s.canceled_at at time zone p_tz) = b.bucket_start
  ) cs on true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'plan', coalesce(x.plan::text, 'desconhecido'),
    'revenue_cents', x.revenue_cents,
    'count', x.count
  ) order by x.revenue_cents desc), '[]'::jsonb)
  into v_by_plan
  from (
    select plan, sum(amount_cents) as revenue_cents, count(*) as count
    from public.payments
    where paid_at >= p_from and paid_at < p_to
    group by plan
  ) x;

  return v_current || jsonb_build_object(
    'prev', v_prev,
    'series', v_series,
    'by_plan', v_by_plan
  );
end;
$$;

revoke all on function public.finance_dashboard(timestamptz, timestamptz, text, text) from public;
grant execute on function public.finance_dashboard(timestamptz, timestamptz, text, text) to authenticated;
