-- ============================================================
-- THE MAGIC LAB — Time Turner period schedule schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Depends on the existing profiles table.
--
-- The school's period times are a fact about the school, not a personal
-- preference, so — like the assessment calendar — a teacher sets them
-- once and every student's planner reads the same schedule. Five day
-- types:
--   - regular: the common case (Guardian 07:45-08:00, not tracked as
--     its own period, then 6 periods of 45 min with 20 min breaks).
--   - friday: early-finish variant, ending 13:00.
--   - test: test-series Tuesdays/Thursdays — 3 periods, break, 3
--     periods, break, then a 7th "test period" slot (not a substitute
--     for period 6, an addition after it).
--   - monday_assembly / wednesday_roc: the occasional variants for the
--     days Monday's Assembly (08:00-09:20) or Wednesday's ROC
--     (08:00-08:50) actually happens, pushing period 1 later but still
--     landing on the same 45 min/20 min period-and-break shape.
-- Which specific upcoming day actually needs the test/assembly/ROC
-- variant is temporary and changes week to week — deliberately not
-- tracked here; a teacher or student just picks the right day type for
-- the blocks that need it, same as picking Regular vs Friday.
-- ============================================================

create table if not exists period_schedule (
  id         uuid primary key default gen_random_uuid(),
  day_type   text not null check (day_type in ('regular', 'friday', 'test', 'monday_assembly', 'wednesday_roc')),
  period     int not null check (period between 1 and 7),
  start_time time not null,
  end_time   time not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (day_type, period)
);

alter table period_schedule enable row level security;

create policy "Signed-in users read period schedule" on period_schedule
  for select using (auth.uid() is not null);

create policy "Teachers manage period schedule" on period_schedule
  for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'teacher'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'teacher'));
