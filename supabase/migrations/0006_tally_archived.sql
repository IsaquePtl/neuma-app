-- Allow archiving Tally intake submissions without deleting them

alter table public.tally_submissions
  drop constraint if exists tally_submissions_status_check;

alter table public.tally_submissions
  add constraint tally_submissions_status_check
  check (status in ('pending', 'linked', 'processed', 'failed', 'archived'));
