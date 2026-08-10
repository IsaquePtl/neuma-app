-- Students can read their own Tally submissions (linked check-ins / intake)

create policy "tally_submissions_student_select_own"
  on public.tally_submissions
  for select
  using (student_id = auth.uid());
