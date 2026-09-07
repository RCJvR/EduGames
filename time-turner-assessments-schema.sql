-- ============================================================
-- THE MAGIC LAB — Time Turner assessment calendar schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Depends on the existing profiles table.
--
-- The school-wide test/exam calendar. Teachers upload it (one at a time
-- or in bulk); students see only what applies to them:
--   - Grade 8-9 take every subject, so they see every assessment for
--     their grade, no filtering needed.
--   - Grade 10-12 choose a subset of subjects (profiles.elective_subjects,
--     added below), so they only see assessments for their grade AND
--     one of their chosen subjects.
-- Not tied to the `classes` table on purpose — a teacher shouldn't need
-- to already have a class set up with enrolled students just to publish
-- a test date.
-- ============================================================

create table if not exists assessments (
  id          uuid primary key default gen_random_uuid(),
  grade       int not null check (grade between 8 and 12),
  subject     text not null,
  type        text not null default 'test' check (type in ('test', 'exam', 'assignment', 'project', 'practical', 'other')),
  title       text not null,
  description text,
  due_date    date,
  term        int,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_assessments_grade    on assessments(grade);
create index if not exists idx_assessments_due_date on assessments(due_date);
create index if not exists idx_assessments_subject  on assessments(subject);

alter table assessments enable row level security;

create policy "Signed-in users read assessments" on assessments
  for select using (auth.uid() is not null);

create policy "Teachers manage assessments" on assessments
  for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'teacher'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'teacher'));

-- A student's own chosen subjects (Grade 10-12 only — Grade 8-9 take
-- everything so this stays null for them). Deliberately a different
-- column from the existing `subjects` (free text, teachers only, what
-- they teach) added in supabase-profile-fields.sql.
alter table profiles add column if not exists elective_subjects text[];
