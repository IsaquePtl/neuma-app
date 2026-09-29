-- Neuma 1:1 invite: duration + one-time billing, split name fields
alter table public.one_to_one_invites
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists duration_months int,
  add column if not exists billing_mode text not null default 'recurring';

comment on column public.one_to_one_invites.billing_mode is
  'recurring = Stripe subscription; one_time = single Checkout payment';
comment on column public.one_to_one_invites.duration_months is
  'Program length in months (access window / subscription cancel_at).';

alter table public.profiles
  add column if not exists one_to_one_access_until timestamptz;

comment on column public.profiles.one_to_one_access_until is
  'For one_time Neuma 1:1 payments: access ends at this timestamp.';

-- Backfill names from full_name where possible
update public.one_to_one_invites
set
  first_name = coalesce(
    first_name,
    nullif(split_part(trim(full_name), ' ', 1), '')
  ),
  last_name = coalesce(
    last_name,
    nullif(trim(substring(trim(full_name) from position(' ' in trim(full_name) || ' '))), '')
  )
where full_name is not null
  and first_name is null;

-- Access: also grant when is_one_to_one + access_until in the future
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
    or (
      coalesce(p.is_one_to_one, false)
      and p.one_to_one_access_until is not null
      and p.one_to_one_access_until > now()
    )
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
