-- Pass rules + phase metadata for Teoria Musical path gates.
-- Does NOT seed library (live already has Teoria Musical category/topics).
-- Does NOT change billing. Does NOT assign students.

do $$ begin
  create type public.node_pass_rule as enum ('mentor', 'quiz', 'check_in', 'none');
exception when duplicate_object then null;
end $$;

alter table public.nodes
  add column if not exists pass_rule public.node_pass_rule not null default 'mentor',
  add column if not exists pass_score integer,
  add column if not exists check_in_kind public.check_in_kind,
  add column if not exists phase_key text,
  add column if not exists node_code text;

alter table public.path_template_nodes
  add column if not exists pass_rule public.node_pass_rule not null default 'mentor',
  add column if not exists pass_score integer,
  add column if not exists check_in_kind public.check_in_kind,
  add column if not exists phase_key text,
  add column if not exists node_code text,
  add column if not exists quiz_questions jsonb not null default '[]'::jsonb;

-- Compat backfill: keep current operational meaning.
-- practice → check-in (vídeo por omissão); lesson → visto sem check-in;
-- milestone/call → mentor (quiz existente continua score-only até pass_rule=quiz).
update public.nodes
  set pass_rule = 'check_in'
  where kind = 'practice' and pass_rule = 'mentor';

update public.nodes
  set pass_rule = 'none'
  where kind in ('lesson', 'resource') and pass_rule = 'mentor';

update public.path_template_nodes
  set pass_rule = 'check_in'
  where kind = 'practice' and pass_rule = 'mentor';

update public.path_template_nodes
  set pass_rule = 'none'
  where kind in ('lesson', 'resource') and pass_rule = 'mentor';

update public.nodes
  set check_in_kind = 'video'
  where kind = 'practice' and check_in_kind is null;

update public.path_template_nodes
  set check_in_kind = 'video'
  where kind = 'practice' and check_in_kind is null;

create unique index if not exists path_template_nodes_code_uidx
  on public.path_template_nodes (template_id, node_code)
  where node_code is not null;

create index if not exists nodes_path_code_idx
  on public.nodes (path_id, node_code)
  where node_code is not null;

alter table public.nodes drop constraint if exists nodes_pass_score_chk;
alter table public.nodes
  add constraint nodes_pass_score_chk
  check (pass_score is null or (pass_score >= 0 and pass_score <= 100));

alter table public.path_template_nodes drop constraint if exists path_template_nodes_pass_score_chk;
alter table public.path_template_nodes
  add constraint path_template_nodes_pass_score_chk
  check (pass_score is null or (pass_score >= 0 and pass_score <= 100));
