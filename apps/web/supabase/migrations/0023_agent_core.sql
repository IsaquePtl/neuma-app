-- 0023: Agent core — threads, runs, proposals, memories + LangGraph checkpoint schema

create schema if not exists langgraph;

create table if not exists public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  pattern text not null default 'supervisor'
    check (pattern in ('supervisor', 'router', 'journey', 'briefing', 'skills')),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_threads_mentor_idx
  on public.agent_threads (mentor_id, last_message_at desc nulls last);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.agent_threads(id) on delete set null,
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  pattern text not null default 'supervisor',
  model text,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'cancelled')),
  latency_ms integer,
  error text,
  token_usage jsonb not null default '{}'::jsonb,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists agent_runs_thread_idx
  on public.agent_runs (thread_id, created_at desc);
create index if not exists agent_runs_mentor_idx
  on public.agent_runs (mentor_id, created_at desc);

create table if not exists public.agent_proposals (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in (
      'path_draft',
      'path_edit',
      'library_gap',
      'calendar_event',
      'checkin_nudge',
      'student_brief'
    )),
  status text not null default 'pending'
    check (status in (
      'pending',
      'approved',
      'rejected',
      'applied',
      'superseded'
    )),
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  target_table text,
  target_id uuid,
  thread_id uuid references public.agent_threads(id) on delete set null,
  run_id uuid references public.agent_runs(id) on delete set null,
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  applied_at timestamptz
);

create index if not exists agent_proposals_pending_idx
  on public.agent_proposals (mentor_id, status, created_at desc)
  where status = 'pending';

create table if not exists public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null default 'global',
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  unique (mentor_id, scope, key)
);

create index if not exists agent_memories_mentor_idx
  on public.agent_memories (mentor_id, scope);

alter table public.agent_threads enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_proposals enable row level security;
alter table public.agent_memories enable row level security;

create policy agent_threads_mentor_own
  on public.agent_threads for all to authenticated
  using (mentor_id = auth.uid() and public.is_mentor())
  with check (mentor_id = auth.uid() and public.is_mentor());

create policy agent_runs_mentor_own
  on public.agent_runs for all to authenticated
  using (mentor_id = auth.uid() and public.is_mentor())
  with check (mentor_id = auth.uid() and public.is_mentor());

create policy agent_proposals_mentor_own
  on public.agent_proposals for all to authenticated
  using (mentor_id = auth.uid() and public.is_mentor())
  with check (mentor_id = auth.uid() and public.is_mentor());

create policy agent_memories_mentor_own
  on public.agent_memories for all to authenticated
  using (mentor_id = auth.uid() and public.is_mentor())
  with check (mentor_id = auth.uid() and public.is_mentor());
