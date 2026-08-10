-- Cal.com bookings ingested via webhook
create table if not exists public.cal_bookings (
  id uuid primary key default gen_random_uuid(),
  cal_booking_uid text not null unique,
  cal_booking_id bigint,
  trigger_event text not null,
  status text not null default 'accepted'
    check (status in ('accepted', 'cancelled', 'rescheduled', 'pending', 'rejected')),
  title text,
  event_type_slug text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  timezone text,
  meet_url text,
  organizer_email text,
  organizer_name text,
  attendee_email text,
  attendee_name text,
  student_id uuid references public.profiles(id) on delete set null,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cal_bookings_start_time_idx on public.cal_bookings (start_time desc);
create index if not exists cal_bookings_student_id_idx on public.cal_bookings (student_id);
create index if not exists cal_bookings_attendee_email_idx on public.cal_bookings (lower(attendee_email));
create index if not exists cal_bookings_status_idx on public.cal_bookings (status);

alter table public.cal_bookings enable row level security;

-- Mentor: full access
create policy "Mentors manage cal_bookings"
  on public.cal_bookings
  for all
  to authenticated
  using (public.is_mentor())
  with check (public.is_mentor());

-- Student: read own bookings (by student_id or email match via linked profile)
create policy "Students read own cal_bookings"
  on public.cal_bookings
  for select
  to authenticated
  using (
    student_id = auth.uid()
    or lower(attendee_email) = lower((
      select email from public.profiles where id = auth.uid()
    ))
  );
