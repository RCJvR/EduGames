-- ============================================================
-- THE MAGIC LAB — Theme Weaver schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Depends on the existing profiles table.
--
-- Theme Weaver is the cross-curricular hub for the school's theme-based
-- learning program (e.g. "Exploration" tying together NS/Geography's soil
-- study, English/Business Studies' market day oral, Afrikaans/LO's shared
-- essay) plus the Grade 8 "new here" onboarding guide (campus logistics,
-- extracurriculars, FAQ, settling-in checklist).
--
-- Unlike assignments (owned by one teacher, scoped to one class), themes
-- are explicitly cross-department: any teacher can contribute to any
-- theme, since a theme only works if NS, Geography, English, Business
-- Studies etc. can all add to the same shared calendar.
-- ============================================================

create table if not exists themes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  grade       int,
  term        text,
  active      boolean not null default true,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- One row per shared assessment / content item / activity under a theme.
-- `subjects` lists every subject involved, so a soil-quality assessment
-- shared by NS and Geography shows up once, tagged with both.
create table if not exists theme_items (
  id          uuid primary key default gen_random_uuid(),
  theme_id    uuid not null references themes(id) on delete cascade,
  subjects    text[] not null default '{}',
  type        text not null default 'assessment' check (type in ('assessment', 'content', 'activity')),
  title       text not null,
  description text,
  due_date    date,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- The "new to the school" survival guide: campus logistics, extracurricular
-- directory, FAQ, and a settling-in checklist, grouped by category.
create table if not exists onboarding_resources (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in ('logistics', 'extracurricular', 'faq', 'checklist')),
  grade      int,
  title      text not null,
  body       text,
  link       text,
  sort_order int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_theme_items_theme       on theme_items(theme_id);
create index if not exists idx_theme_items_due_date     on theme_items(due_date);
create index if not exists idx_themes_grade_active      on themes(grade, active);
create index if not exists idx_onboarding_category_grade on onboarding_resources(category, grade);

alter table themes enable row level security;
alter table theme_items enable row level security;
alter table onboarding_resources enable row level security;

-- Any signed-in user can read; only teachers can write. Themes are a
-- shared cross-department resource, not owned by whoever created them —
-- any teacher can edit any theme so NS, Geography, English etc. can all
-- maintain the same shared plan.
create policy "Signed-in users read themes" on themes
  for select using (auth.uid() is not null);

create policy "Teachers manage themes" on themes
  for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'teacher'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'teacher'));

create policy "Signed-in users read theme items" on theme_items
  for select using (auth.uid() is not null);

create policy "Teachers manage theme items" on theme_items
  for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'teacher'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'teacher'));

create policy "Signed-in users read onboarding resources" on onboarding_resources
  for select using (auth.uid() is not null);

create policy "Teachers manage onboarding resources" on onboarding_resources
  for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'teacher'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'teacher'));
