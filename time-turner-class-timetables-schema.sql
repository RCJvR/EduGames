-- ============================================================
-- THE MAGIC LAB — Time Turner shared class timetable schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Depends on the existing profiles and classes tables.
--
-- One register class (8A1, 8A2, 9E3, ...) has its own distinct 10-day,
-- 6-period timetable — a whole grade does NOT share a single timetable,
-- since different classes in the same grade rotate through different
-- rooms/specialist subjects. A teacher uploads it once for a class they
-- own, and students in that class import it into their own Time Turner
-- plan instead of adding all 60 periods by hand.
--
-- grid is keyed by cycle day ("1".."10") -> an array of 6 subject names
-- (period 1..6; an empty string means a free period or break that day).
-- One row per class (re-uploading replaces that class's grid outright).
--
-- Read access matches the broad "signed-in users read" pattern used for
-- assessments — a timetable isn't sensitive. Write access is narrower:
-- only the class's own teacher (classes.teacher_id), not "any teacher"
-- the way assessments and the old (never-used) grade_timetables worked —
-- a class already has one specific owner.
-- ============================================================

create table if not exists class_timetables (
  class_id   uuid primary key references classes(id) on delete cascade,
  grid       jsonb not null default '{}'::jsonb,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table class_timetables enable row level security;

create policy "Signed-in users read class timetables" on class_timetables
  for select using (auth.uid() is not null);

create policy "Class teacher manages their class timetable" on class_timetables
  for all
  using (exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid()));
