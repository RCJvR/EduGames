-- ============================================================
-- THE MAGIC LAB — Time Turner wellbeing summary schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Depends on the existing profiles / classes / class_members tables
-- and the existing teacher_has_student(uuid) function.
--
-- The personal planner (time-turner.js) is entirely client-side —
-- entries never leave the student's browser. This table stores only
-- the WEEKLY CATEGORY TOTALS (minutes of school/homework/rest/free/
-- etc. per week), not the underlying schedule, so a teacher can see
-- "low rest, no free time" without seeing exactly what a student's
-- day looks like block by block. A student who has never used their
-- planner simply has no row here — absence of data, not a flag.
--
-- Access follows the same shape as reading a student's profile:
-- a student manages their own row; a teacher can read a student's
-- row only if that student is in one of the teacher's classes
-- (teacher_has_student), same as everywhere else on the platform —
-- there is no school-wide "any teacher can see any student" access.
-- ============================================================

create table if not exists planner_summaries (
  student_id     uuid primary key references profiles(id) on delete cascade,
  weekly_minutes jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);

alter table planner_summaries enable row level security;

create policy "Students manage their own planner summary" on planner_summaries
  for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "Teachers read their students' planner summaries" on planner_summaries
  for select
  using (teacher_has_student(student_id));
