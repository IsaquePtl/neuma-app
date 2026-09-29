-- Link subscriptions and payments whose Stripe metadata names a profile
-- that still exists. Rows whose metadata points at a deleted user stay
-- null (profiles are removed with on delete set null). Safe to re-run.

update public.subscriptions s
set profile_id = (s.raw -> 'metadata' ->> 'neuma_profile_id')::uuid
where s.profile_id is null
  and (s.raw -> 'metadata' ->> 'neuma_profile_id')
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.profiles p
    where p.id = (s.raw -> 'metadata' ->> 'neuma_profile_id')::uuid
  );

update public.payments pay
set profile_id = sub.profile_id
from public.subscriptions sub
where pay.profile_id is null
  and pay.subscription_id = sub.id
  and sub.profile_id is not null;
