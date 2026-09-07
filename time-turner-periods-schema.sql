-- ============================================================
-- THE MAGIC LAB — Time Turner period schedule schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Depends on the existing profiles table.
--
-- The school's period times are a fact about the school, not a personal
-- preference, so — like the assessment calendar — a teacher sets them
-- once and every student's planner reads the same schedule. Three day
-- types: a normal day and an early-finish Friday (6 periods each), and
-- a "test" day for test-series Tuesdays/Thursdays — 3 periods, break,
-- 3 periods, break, then a 7th "test period" slot (not a substitute for
-- period 6, an addition after it). Which specific upcoming Tuesdays/
-- Thursdays are actually in a test series is a temporary, per-grade
-- fact that changes week to week — deliberately not tracked here; a
-- teacher or student just picks "Test day" for the blocks that need
-- it, same as picking Regular vs Friday.
-- ============================================================

create table if not exists period_schedule (
  id         uuid primary key default gen_random_uuid(),
  day_type   text not null check (day_type in ('regular', 'friday', 'test')),
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
