-- Intake Tally: onboarding sem login + check-ins externos com ligação opcional

create table public.tally_submissions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'tally',
  source_event_id text unique,
  source_response_id text,
  source_submission_id text,
  source_form_id text not null,
  source_form_name text,
  submission_kind text not null check (submission_kind in ('onboarding', 'checkin', 'unknown')),
  status text not null default 'pending' check (status in ('pending', 'linked', 'processed', 'failed')),
  respondent_name text,
  respondent_email text,
  student_id uuid references public.profiles(id) on delete set null,
  node_id uuid references public.nodes(id) on delete set null,
  check_in_id uuid references public.check_ins(id) on delete set null,
  notes text,
  video_url text,
  answers jsonb not null default '[]'::jsonb,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index tally_submissions_kind_status_idx
  on public.tally_submissions (submission_kind, status, created_at desc);
create index tally_submissions_student_idx
  on public.tally_submissions (student_id, created_at desc);
create index tally_submissions_checkin_idx
  on public.tally_submissions (check_in_id);

alter table public.tally_submissions enable row level security;

create policy "tally_submissions_mentor_all" on public.tally_submissions
  for all using (public.is_mentor()) with check (public.is_mentor());
