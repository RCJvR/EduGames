// ============================================================
// THE MAGIC LAB — theme-weaver.js
// Theme Weaver SDK — include after auth.js
// Usage: <script src="auth.js"></script>
//        <script src="theme-weaver.js"></script>
//
// Requires the tables created by theme-weaver-schema.sql
// (themes, theme_items, onboarding_resources) to exist in Supabase.
// ============================================================

document.addEventListener('magiclab:auth:ready', () => {
  window.MagicLabThemeWeaver = {
    getActiveThemes,
    getTheme,
    createTheme,
    setThemeActive,
    deleteTheme,
    addThemeItem,
    deleteThemeItem,
    getUpcomingItems,
    getOnboardingResources,
    addOnboardingResource,
    deleteOnboardingResource
  };
  document.dispatchEvent(new CustomEvent('magiclab:themeweaver:ready'));
});

function _requireTeacher() {
  const auth = window.MagicLabAuth;
  if (!auth?.isLoggedIn()) return { error: { message: 'Not logged in' } };
  if (!auth.isTeacher()) return { error: { message: 'Only teachers can do that' } };
  return null;
}

/** Active themes, optionally filtered to a grade (themes with no grade set show for everyone). */
async function getActiveThemes(grade = null) {
  const auth = window.MagicLabAuth;
  if (!auth?.isLoggedIn()) return [];
  const supabase = auth._supabase();

  let query = supabase.from('themes').select('*').eq('active', true).order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) { console.warn('[MagicLab] getActiveThemes error:', error.message); return []; }

  return grade ? data.filter(t => t.grade == null || t.grade === grade) : data;
}

/** One theme with all of its items, items sorted by due date (nulls last). */
async function getTheme(themeId) {
  const auth = window.MagicLabAuth;
  if (!auth?.isLoggedIn()) return { error: { message: 'Not logged in' } };
  const supabase = auth._supabase();

  const { data: theme, error } = await supabase.from('themes').select('*').eq('id', themeId).single();
  if (error) return { error };

  const { data: items, error: itemsErr } = await supabase
    .from('theme_items')
    .select('*')
    .eq('theme_id', themeId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (itemsErr) return { error: itemsErr };

  return { data: { ...theme, items: items || [] } };
}

async function createTheme({ name, description = null, grade = null, term = null }) {
  const denied = _requireTeacher();
  if (denied) return denied;
  if (!name) return { error: { message: 'name is required' } };

  const supabase = window.MagicLabAuth._supabase();
  const createdBy = window.MagicLabAuth.getProfile()?.id;

  return supabase.from('themes').insert({ name, description, grade, term, created_by: createdBy }).select().single();
}

async function setThemeActive(themeId, active) {
  const denied = _requireTeacher();
  if (denied) return denied;
  const supabase = window.MagicLabAuth._supabase();
  return supabase.from('themes').update({ active }).eq('id', themeId).select().single();
}

async function deleteTheme(themeId) {
  const denied = _requireTeacher();
  if (denied) return denied;
  const supabase = window.MagicLabAuth._supabase();
  return supabase.from('themes').delete().eq('id', themeId);
}

/**
 * @param {Object} opts
 * @param {string} opts.themeId
 * @param {string[]} opts.subjects   — e.g. ['Natural Sciences', 'Geography']
 * @param {string} [opts.type]       — 'assessment' | 'content' | 'activity'
 * @param {string} opts.title
 * @param {string} [opts.description]
 * @param {string} [opts.dueDate]    — ISO date
 */
async function addThemeItem({ themeId, subjects = [], type = 'assessment', title, description = null, dueDate = null }) {
  const denied = _requireTeacher();
  if (denied) return denied;
  if (!themeId || !title) return { error: { message: 'themeId and title are required' } };

  const supabase = window.MagicLabAuth._supabase();
  const createdBy = window.MagicLabAuth.getProfile()?.id;
  const cleanSubjects = subjects.map(s => s.trim()).filter(Boolean);

  return supabase
    .from('theme_items')
    .insert({ theme_id: themeId, subjects: cleanSubjects, type, title, description, due_date: dueDate, created_by: createdBy })
    .select()
    .single();
}

async function deleteThemeItem(itemId) {
  const denied = _requireTeacher();
  if (denied) return denied;
  const supabase = window.MagicLabAuth._supabase();
  return supabase.from('theme_items').delete().eq('id', itemId);
}

/**
 * The combined "this week across subjects" calendar — every item from
 * every active theme (optionally filtered to a grade), sorted by due
 * date. This is the whole point of Theme Weaver: one list instead of
 * six subjects' worth of scattered Teams posts.
 */
async function getUpcomingItems(grade = null) {
  const themes = await getActiveThemes(grade);
  if (!themes.length) return [];

  const auth = window.MagicLabAuth;
  const supabase = auth._supabase();
  const themeIds = themes.map(t => t.id);
  const themesById = Object.fromEntries(themes.map(t => [t.id, t]));

  const { data: items, error } = await supabase
    .from('theme_items')
    .select('*')
    .in('theme_id', themeIds)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) { console.warn('[MagicLab] getUpcomingItems error:', error.message); return []; }

  return (items || []).map(item => ({ ...item, theme: themesById[item.theme_id] }));
}

/** Onboarding resources for a category, optionally filtered to a grade, ordered for display. */
async function getOnboardingResources(category, grade = null) {
  const auth = window.MagicLabAuth;
  if (!auth?.isLoggedIn()) return [];
  const supabase = auth._supabase();

  let query = supabase.from('onboarding_resources').select('*').eq('category', category).order('sort_order', { ascending: true });
  const { data, error } = await query;
  if (error) { console.warn('[MagicLab] getOnboardingResources error:', error.message); return []; }

  return grade ? data.filter(r => r.grade == null || r.grade === grade) : data;
}

async function addOnboardingResource({ category, grade = null, title, body = null, link = null, sortOrder = 0 }) {
  const denied = _requireTeacher();
  if (denied) return denied;
  if (!category || !title) return { error: { message: 'category and title are required' } };

  const supabase = window.MagicLabAuth._supabase();
  const createdBy = window.MagicLabAuth.getProfile()?.id;

  return supabase
    .from('onboarding_resources')
    .insert({ category, grade, title, body, link, sort_order: sortOrder, created_by: createdBy })
    .select()
    .single();
}

async function deleteOnboardingResource(resourceId) {
  const denied = _requireTeacher();
  if (denied) return denied;
  const supabase = window.MagicLabAuth._supabase();
  return supabase.from('onboarding_resources').delete().eq('id', resourceId);
}
