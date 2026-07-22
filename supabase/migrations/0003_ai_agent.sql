-- Neuma 0003: resource URLs, mentor prefs, AI drafts, storage hints

-- Link/material opcional em nodes (recursos e calls)
alter table public.nodes
  add column if not exists resource_url text;

-- Preferencias do mentor (Cal + estilo para o agent)
alter table public.profiles
  add column if not exists cal_username text,
  add column if not exists mentor_style_notes text;

-- Rascunhos de feedback gerados pelo AI Agent (HITL)
do $$ begin
  create type public.feedback_draft_status as enum (
    'pending_review',
    'published',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.feedback_drafts (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  mentor_id uuid references public.profiles(id) on delete set null,
  status public.feedback_draft_status not null default 'pending_review',
  body_notes text,
  body_next_steps text,
  model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (check_in_id)
);

create index if not exists feedback_drafts_status_idx
  on public.feedback_drafts (status);

alter table public.feedback_drafts enable row level security;

drop policy if exists "Mentors manage feedback drafts" on public.feedback_drafts;
create policy "Mentors manage feedback drafts"
  on public.feedback_drafts for all
  using (public.is_mentor())
  with check (public.is_mentor());

-- Storage bucket para videos de check-in (criar no dashboard se o SQL storage nao estiver disponivel)
insert into storage.buckets (id, name, public)
values ('check-ins', 'check-ins', false)
on conflict (id) do nothing;

drop policy if exists "Students upload own check-in videos" on storage.objects;
create policy "Students upload own check-in videos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'check-ins'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Students read own check-in videos" on storage.objects;
create policy "Students read own check-in videos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'check-ins'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_mentor()
    )
  );

drop policy if exists "Mentors read check-in videos" on storage.objects;
create policy "Mentors read check-in videos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'check-ins' and public.is_mentor());
