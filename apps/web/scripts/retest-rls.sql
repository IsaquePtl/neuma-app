-- Rolled-back role loop. The DO block raises on purpose so nothing commits.
-- Variable names never match column names. Do not enable variable_conflict.
do $$
declare
  v_mentor uuid := '11111111-1111-4111-8111-111111111111';
  v_student uuid := '22222222-2222-4222-8222-222222222222';
  v_other uuid := '33333333-3333-4333-8333-333333333333';
  kinds text[] := array['lesson','resource','practice','call','milestone'];
  rules text[] := array['none','quiz','check_in','mentor'];
  cikinds text[] := array['video','text','call'];
  k text;
  r text;
  c text;
  v_path uuid;
  v_node uuid;
  v_next uuid;
  v_question uuid;
  v_extend uuid;
  v_svc_node uuid;
  v_svc_next uuid;
  v_svc_path uuid;
  visible int;
  updated int;
  key_rows int;
  attempt_ok int;
  cin_ok int;
  self_ok int;
  active_count int;
  v_svc_active int;
  insert_fail int := 0;
  visible_fail int := 0;
  student_write int := 0;
  key_leak int := 0;
  attempt_fail int := 0;
  checkin_fail int := 0;
  self_approve int := 0;
  mentor_bad int := 0;
  rows_done int := 0;
  ext_before int;
  ext_after int;
  due_after date;
  pending_left int;
  revision_n int;
  other_paths int;
  settings_rows int;
  cutoff text;
  grace text;
  who text;
  v_link_sub boolean;
  v_link_orphan boolean;
  v_link_pay boolean;
  report jsonb;
begin
  insert into auth.users (
    id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (v_mentor, 'authenticated', 'authenticated', 'retest-mentor-c91c@example.invalid', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_student, 'authenticated', 'authenticated', 'retest-student-c91c@example.invalid', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_other, 'authenticated', 'authenticated', 'retest-other-c91c@example.invalid', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  update public.profiles set role = 'mentor', full_name = 'Retest Mentor' where id = v_mentor;
  update public.profiles set full_name = 'Retest Student' where id = v_student;

  foreach k in array kinds loop
    foreach r in array rules loop
      foreach c in array cikinds loop
        insert into public.paths (student_id, created_by, title, status)
        values (v_student, v_mentor, k || ' ' || r || ' ' || c, 'active')
        returning id into v_path;

        insert into public.nodes (path_id, title, order_index, status, kind, pass_rule, check_in_kind, pass_score)
        values (v_path, 'level', 0, 'active', k::public.node_kind, r::public.node_pass_rule,
                case when r = 'check_in' then c::public.check_in_kind else null end, 60)
        returning id into v_node;

        insert into public.nodes (path_id, title, order_index, status, kind, pass_rule)
        values (v_path, 'next', 1, 'locked', 'lesson', 'none')
        returning id into v_next;

        if r = 'quiz' then
          insert into public.node_quiz_questions (node_id, order_index, prompt, options, correct_option_id)
          values (v_node, 0, 'q', '[{"id":"a","label":"A"},{"id":"b","label":"B"}]'::jsonb, 'b')
          returning id into v_question;
        end if;

        rows_done := rows_done + 1;
      end loop;
    end loop;
  end loop;

  if rows_done <> 60 then
    insert_fail := 60 - rows_done;
  end if;

  perform set_config('request.jwt.claim.sub', v_student::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  set local role authenticated;
  who := current_user;

  select count(*) into visible
  from public.nodes n
  join public.paths p on p.id = n.path_id
  where p.student_id = v_student and n.title = 'level';
  if visible <> 60 then visible_fail := visible_fail + 1; end if;

  update public.nodes n
  set status = 'completed'
  from public.paths p
  where n.path_id = p.id and p.student_id = v_student and n.title = 'level';
  get diagnostics updated = row_count;
  if updated <> 0 then student_write := updated; end if;

  select count(*) into key_rows
  from public.node_quiz_questions q
  join public.nodes n on n.id = q.node_id
  join public.paths p on p.id = n.path_id
  where p.student_id = v_student;
  key_leak := key_rows;

  insert into public.node_quiz_attempts (node_id, student_id, answers, score, correct_count, total)
  select n.id, v_student, '{}'::jsonb, 100, 1, 1
  from public.nodes n
  join public.paths p on p.id = n.path_id
  where p.student_id = v_student and n.pass_rule = 'quiz' and n.title = 'level';
  get diagnostics attempt_ok = row_count;
  if attempt_ok <> 15 then attempt_fail := attempt_fail + 1; end if;

  insert into public.check_ins (node_id, student_id, kind, notes, status)
  select n.id, v_student, n.check_in_kind, 'ok', 'pending'
  from public.nodes n
  join public.paths p on p.id = n.path_id
  where p.student_id = v_student and n.pass_rule = 'check_in' and n.title = 'level';
  get diagnostics cin_ok = row_count;
  if cin_ok <> 15 then checkin_fail := checkin_fail + 1; end if;

  update public.check_ins set status = 'approved' where student_id = v_student;
  get diagnostics self_ok = row_count;
  self_approve := self_ok;

  select count(*) into settings_rows from public.finance_settings;

  reset role;

  -- Service role equivalent: RLS bypass, the write a student session cannot do.
  select n.id, nx.id, n.path_id
    into v_svc_node, v_svc_next, v_svc_path
  from public.nodes n
  join public.paths p on p.id = n.path_id
  join public.nodes nx on nx.path_id = p.id and nx.title = 'next'
  where p.student_id = v_student
    and p.title = 'lesson none video'
    and n.title = 'level';

  update public.nodes set status = 'completed' where id = v_svc_node;
  update public.nodes set status = 'active' where id = v_svc_next;
  update public.nodes
  set status = 'locked'
  where path_id = v_svc_path
    and id <> v_svc_node
    and id <> v_svc_next
    and status <> 'completed';
  select count(*) into v_svc_active
  from public.nodes
  where path_id = v_svc_path and status = 'active';

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into other_paths from public.paths where student_id = v_student;
  reset role;

  perform set_config('request.jwt.claim.sub', v_mentor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mentor, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select n.id, n.week_extensions into v_extend, ext_before
  from public.nodes n
  join public.paths p on p.id = n.path_id
  where p.student_id = v_student
    and p.title = 'practice check_in video'
    and n.title = 'level';

  update public.nodes
  set due_date = date '2026-10-04', status = 'active'
  where id = v_extend;
  update public.nodes
  set week_extensions = week_extensions + 1
  where id = v_extend;
  update public.check_ins as c
  set status = 'needs_revision'
  where c.node_id = v_extend and c.status = 'pending';

  select n.week_extensions, n.due_date into ext_after, due_after
  from public.nodes n where n.id = v_extend;
  select count(*) into pending_left
  from public.check_ins c
  where c.node_id = v_extend and c.status = 'pending';
  select count(*) into revision_n
  from public.check_ins c
  where c.node_id = v_extend and c.status = 'needs_revision';

  for v_path in
    select p.id
    from public.paths p
    where p.student_id = v_student
      and p.title <> 'practice check_in video'
      and p.title <> 'lesson none video'
  loop
    select n.id into v_node
    from public.nodes n
    where n.path_id = v_path and n.title = 'level';
    select n.id into v_next
    from public.nodes n
    where n.path_id = v_path and n.title = 'next';
    update public.nodes set status = 'completed' where id = v_node;
    update public.nodes set status = 'active' where id = v_next;
    update public.nodes
    set status = 'locked'
    where path_id = v_path
      and id <> v_node
      and id <> v_next
      and status <> 'completed';
    select count(*) into active_count
    from public.nodes n
    where n.path_id = v_path and n.status = 'active';
    if active_count <> 1 then mentor_bad := mentor_bad + 1; end if;
  end loop;

  reset role;

  insert into public.subscriptions (
    profile_id, stripe_customer_id, stripe_subscription_id, status, currency, raw
  ) values
    (null, 'cus_retest_c91c', 'sub_retest_c91c', 'active', 'eur',
     jsonb_build_object('metadata', jsonb_build_object('neuma_profile_id', v_student::text), 'livemode', false)),
    (null, 'cus_retest_orphan_c91c', 'sub_retest_orphan_c91c', 'active', 'eur',
     jsonb_build_object('metadata', jsonb_build_object('neuma_profile_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'livemode', false));

  update public.subscriptions s
  set profile_id = (s.raw -> 'metadata' ->> 'neuma_profile_id')::uuid
  where s.profile_id is null
    and s.stripe_subscription_id in ('sub_retest_c91c', 'sub_retest_orphan_c91c')
    and (s.raw -> 'metadata' ->> 'neuma_profile_id')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1 from public.profiles p
      where p.id = (s.raw -> 'metadata' ->> 'neuma_profile_id')::uuid
    );

  insert into public.payments (
    profile_id, subscription_id, stripe_invoice_id, amount_cents, currency, status
  )
  select null, s.id, 'in_retest_c91c', 2494, 'eur', 'paid'
  from public.subscriptions s
  where s.stripe_subscription_id = 'sub_retest_c91c';

  update public.payments pay
  set profile_id = sub.profile_id
  from public.subscriptions sub
  where pay.stripe_invoice_id = 'in_retest_c91c'
    and pay.profile_id is null
    and pay.subscription_id = sub.id
    and sub.profile_id is not null;

  select s.profile_id = v_student into v_link_sub
  from public.subscriptions s where s.stripe_subscription_id = 'sub_retest_c91c';
  select s.profile_id is null into v_link_orphan
  from public.subscriptions s where s.stripe_subscription_id = 'sub_retest_orphan_c91c';
  select pay.profile_id = v_student into v_link_pay
  from public.payments pay where pay.stripe_invoice_id = 'in_retest_c91c';

  select s.value #>> '{}' into cutoff
  from public.finance_settings s where s.key = 'paywall_start_at';
  select s.value #>> '{}' into grace
  from public.finance_settings s where s.key = 'past_due_grace_days';

  report := jsonb_build_object(
    'who', who,
    'rows', rows_done,
    'insert_fail', insert_fail,
    'visible', visible,
    'visible_fail', visible_fail,
    'student_writes', student_write,
    'quiz_key_rows', key_leak,
    'quiz_attempts', attempt_ok,
    'attempt_fail', attempt_fail,
    'checkins', cin_ok,
    'checkin_fail', checkin_fail,
    'self_approve', self_approve,
    'student_settings_rows', settings_rows,
    'other_student_paths', other_paths,
    'service_role_active', v_svc_active,
    'week_extensions', ext_before || '->' || ext_after,
    'due', due_after,
    'pending_left', pending_left,
    'needs_revision_on_node', revision_n,
    'mentor_bad_active', mentor_bad,
    'cutoff', cutoff,
    'grace', grace,
    'link_existing_profile', v_link_sub,
    'link_deleted_profile_stays_null', v_link_orphan,
    'link_payment', v_link_pay
  );

  raise exception 'RETEST %', report;
end $$;
