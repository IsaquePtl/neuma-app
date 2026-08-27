-- 0021: Allow paths without a student (draft journeys for Márcio/Eduardo etc.)

alter table public.paths
  alter column student_id drop not null;

alter table public.paths
  add column if not exists placeholder_name text,
  add column if not exists claim_email text,
  add column if not exists claimed_at timestamptz;

create index if not exists paths_claim_email_idx
  on public.paths (lower(claim_email))
  where claim_email is not null and student_id is null;

create index if not exists paths_placeholder_idx
  on public.paths (placeholder_name)
  where student_id is null;

-- Student select already uses student_id = auth.uid(), so null rows stay invisible.
-- Mentors keep full access via paths_mentor_all.
