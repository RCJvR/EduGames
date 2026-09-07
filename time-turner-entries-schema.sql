-- ============================================================
-- THE MAGIC LAB — Time Turner cross-device sync schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Depends on the existing profiles table.
--
-- The personal planner used to be localStorage-only (see time-turner.js's
-- header comment history) — nothing followed a student between browsers
-- or devices. This table is the full private schedule (entries, the
-- plan name shown when printing, and dismissed suggestions), synced
-- from whichever device a student last used it on.
--
-- Deliberately a SEPARATE table from planner_summaries (the weekly
-- category totals a teacher can read for their own students) — this
-- one is the actual detailed schedule, and stays student-only. No
-- teacher policy at all, on purpose.
-- ============================================================

create table if not exists planner_entries (
  student_id            uuid primary key references profiles(id) on delete cascade,
  plan_name             text,
  entries               jsonb not null default '[]'::jsonb,
  dismissed_suggestions jsonb not null default '[]'::jsonb,
  updated_at            timestamptz not null default now()
);

alter table planner_entries enable row level security;

create policy "Students manage their own planner entries" on planner_entries
  for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ── Live .ics subscription (see supabase/functions/ics-feed) ──────────
-- feed_token is an opaque, unguessable per-student token generated
-- client-side (time-turner.js's ensureFeedToken()) — it authorizes the
-- public ics-feed Edge Function to hand back this student's calendar to
-- a plain, unauthenticated GET from a calendar app, since a webcal://
-- subscription can never carry a Supabase session. It grants no other
-- access; RLS above is unchanged, so a browser session still only ever
-- reads/writes its own row.
-- anchor_date is the real calendar date of "Day 1" of the school's
-- 10-day timetable cycle — the same value the static .ics export in
-- time-turner.js already asks for, stored here so the live feed can
-- place timetable-day blocks on real dates too.
alter table planner_entries add column if not exists feed_token uuid;
alter table planner_entries add column if not exists anchor_date date;
create unique index if not exists planner_entries_feed_token_key on planner_entries(feed_token);
