-- Students insert check-ins as pending. A forged status = 'approved'
-- must not pass RLS. Quiz scores are computed on the server and
-- inserted with the service role, so the student INSERT policy goes away.

drop policy if exists checkins_student_insert on public.check_ins;

create policy checkins_student_insert
  on public.check_ins for insert
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and (
      node_id is null
      or exists (
        select 1
        from public.nodes n
        join public.paths p on p.id = n.path_id
        where n.id = check_ins.node_id
          and p.student_id = auth.uid()
          and p.status <> 'draft'
      )
    )
  );

drop policy if exists "Students insert own node_quiz_attempts" on public.node_quiz_attempts;
