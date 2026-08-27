-- 0020: Fix orphan check-in RLS (node_id nullable since 0016)
-- Students may insert check-ins without a node (orphan / pre-path).

drop policy if exists checkins_student_insert on public.check_ins;

create policy checkins_student_insert
  on public.check_ins for insert
  with check (
    student_id = auth.uid()
    and (
      node_id is null
      or exists (
        select 1
        from public.nodes n
        join public.paths p on p.id = n.path_id
        where n.id = check_ins.node_id
          and p.student_id = auth.uid()
      )
    )
  );
