-- 0026: Cleanup unused tables + mentor dashboard facts RPC

-- Drop unused form/diagnostics stack (Tally replaced native forms; diagnostics unused)
drop table if exists public.form_responses cascade;
drop table if exists public.form_questions cascade;
drop table if exists public.forms cascade;
drop table if exists public.diagnostics cascade;

-- Mentor dashboard facts: real days since last check-in (NULL = never)
create or replace function public.mentor_dashboard_facts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_mentor() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'pending_checkins', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      from (
        select
          c.id,
          c.created_at,
          c.student_id,
          coalesce(p.full_name, p.email, 'Aluno') as student_name,
          coalesce(n.title, c.level_label, 'Bloco') as node_title
        from public.check_ins c
        left join public.profiles p on p.id = c.student_id
        left join public.nodes n on n.id = c.node_id
        where c.status = 'pending'
        order by c.created_at asc
        limit 12
      ) x
    ),
    'upcoming_sessions', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      from (
        select
          b.id,
          b.start_time,
          b.title,
          b.attendee_name,
          b.attendee_email,
          b.student_id,
          b.meet_url,
          active_node.title as active_node_title,
          active_node.order_index as active_node_index
        from public.cal_bookings b
        left join lateral (
          select n.title, n.order_index
          from public.paths pa
          join public.nodes n on n.path_id = pa.id and n.status = 'active'
          where pa.student_id = b.student_id and pa.status = 'active'
          order by n.order_index
          limit 1
        ) active_node on true
        where b.status in ('accepted', 'pending', 'rescheduled')
          and b.start_time >= now()
        order by b.start_time asc
        limit 6
      ) x
    ),
    'pending_onboardings', (
      select count(*)::int
      from public.tally_submissions
      where submission_kind = 'onboarding' and status = 'pending'
    ),
    'active_paths', (
      select count(*)::int from public.paths where status = 'active'
    ),
    'quiet_students', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      from (
        select
          p.id,
          coalesce(p.full_name, p.email, 'Aluno') as name,
          case
            when last_ci.last_at is null then null
            else floor(extract(epoch from (now() - last_ci.last_at)) / 86400)::int
          end as days_since_last_checkin,
          last_ci.last_at is null as never_checked_in
        from public.profiles p
        join public.paths pa on pa.student_id = p.id and pa.status = 'active'
        left join lateral (
          select max(c.created_at) as last_at
          from public.check_ins c
          where c.student_id = p.id
        ) last_ci on true
        where p.role = 'student'
          and (
            last_ci.last_at is null
            or last_ci.last_at < now() - interval '7 days'
          )
        order by
          case when last_ci.last_at is null then 1 else 0 end,
          last_ci.last_at asc nulls first
        limit 8
      ) x
    ),
    'pending_proposals', (
      select count(*)::int
      from public.agent_proposals
      where status = 'pending'
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.mentor_dashboard_facts() from public;
grant execute on function public.mentor_dashboard_facts() to authenticated;
