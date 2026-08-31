-- Check-in video storage: bucket + policies (upload/read/update own folder)

insert into storage.buckets (id, name, public, file_size_limit)
values ('check-ins', 'check-ins', false, 157286400)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit;

drop policy if exists "Students upload own check-in videos" on storage.objects;
create policy "Students upload own check-in videos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'check-ins'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Students update own check-in videos" on storage.objects;
create policy "Students update own check-in videos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'check-ins'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
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

-- Reaffirm check-in insert (orphan + owned node)
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
          and p.status <> 'draft'
      )
    )
  );
