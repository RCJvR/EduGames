// ============================================================
// THE MAGIC LAB — time-turner-assessments.js
// The school-wide assessment calendar for Time Turner. Requires the
// `assessments` table (and profiles.elective_subjects column) from
// time-turner-assessments-schema.sql. Include after auth.js.
//
// Grade 8-9 take every subject, but a handful of "compulsory" subjects
// actually come in mutually-exclusive options the learner picks (a
// home-language pair, a creative-arts choice, etc — see CHOICE_GROUPS
// below). Add a new split there and learners get a picker for it with
// no other code changes. Grade 10-12 pick their own subjects outright,
// then only see assessments matching both their grade and one of them.
// ============================================================

(function () {
  const TYPE_LABELS = {
    test: 'Test', exam: 'Exam', assignment: 'Assignment',
    project: 'Project', practical: 'Practical', other: 'Other'
  };

  /** Grade 8-9 "everyone takes every subject" splits into a few spots
   * where the learner actually picks one of several options. Each group
   * applies to the listed grades; a learner must resolve every group
   * that applies to their grade before their calendar unlocks. Add a
   * group here (new elective split, different grades) — no other code
   * needs to change. */
  const CHOICE_GROUPS = [
    {
      name: 'Home Language',
      grades: [8, 9],
      options: [
        { label: 'English HL + Afrikaans FAL', subjects: ['English Home Language', 'Afrikaans First Additional Language'] },
        { label: 'Afrikaans HL + English FAL', subjects: ['Afrikaans Home Language', 'English First Additional Language'] }
      ]
    },
    {
      name: 'Creative Arts',
      grades: [8, 9],
      options: [
        { label: 'Music', subjects: ['Music'] },
        { label: 'Visual Arts', subjects: ['Visual Arts'] }
      ]
    }
  ];

  function groupsForGrade(grade) { return CHOICE_GROUPS.filter(g => g.grades.includes(grade)); }
  function chosenOptionForGroup(group) { return group.options.find(o => o.subjects.every(s => mySubjects.includes(s))); }
  function hasAllChoicesForGrade(grade) { return groupsForGrade(grade).every(g => !!chosenOptionForGroup(g)); }
  function isSubjectSetupComplete() { return profile.grade >= 10 ? mySubjects.length > 0 : hasAllChoicesForGrade(profile.grade); }

  let profile = null;
  let mySubjects = [];        // grade 10-12: elective subjects. grade 8-9: union of chosen options across CHOICE_GROUPS.
  let availableSubjects = []; // distinct subjects on record for this grade
  let viewMode = 'mine';      // 'mine' | 'all'
  let subjectFilter = '';    // '' = all subjects

  function supabase() { return window.MagicLabAuth._supabase(); }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtDate(d) {
    if (!d) return null;
    return new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function daysUntil(d) {
    if (!d) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(d + 'T00:00:00');
    return Math.round((due - today) / 86400000);
  }

  /** Teachers often upload the same task once per day of a multi-day
   * window (a practical rotation, an "assessment week", staggered
   * hand-ins) rather than as one row with a date range. Collapse runs
   * of same grade+subject+type+title landing within 4 days of each
   * other (enough to bridge a weekend) into a single window item, so
   * the student-facing list reads as "one task, several days" instead
   * of counting each day as its own assessment. */
  function groupWindows(list) {
    const dated = list.filter(a => a.due_date);
    const undated = list.filter(a => !a.due_date);
    const groups = new Map();
    dated.forEach(a => {
      const key = `${a.grade}|${a.subject}|${a.type}|${a.title}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    });
    const result = [];
    groups.forEach(items => {
      items.sort((a, b) => a.due_date.localeCompare(b.due_date));
      let chain = [items[0]];
      for (let i = 1; i < items.length; i++) {
        const gapDays = (new Date(items[i].due_date) - new Date(chain[chain.length - 1].due_date)) / 86400000;
        if (gapDays <= 4) chain.push(items[i]);
        else { result.push(mergeWindow(chain)); chain = [items[i]]; }
      }
      result.push(mergeWindow(chain));
    });
    result.sort((a, b) => a.due_date.localeCompare(b.due_date));
    return [...result, ...undated];
  }

  function mergeWindow(chain) {
    if (chain.length === 1) return chain[0];
    return { ...chain[0], due_date: chain[0].due_date, due_date_end: chain[chain.length - 1].due_date, _windowCount: chain.length };
  }

  function isDueToday(a) {
    if (!a.due_date) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(a.due_date + 'T00:00:00');
    const end = new Date((a.due_date_end || a.due_date) + 'T00:00:00');
    return today >= start && today <= end;
  }

  function fmtDateRange(a) {
    if (!a.due_date) return 'No date';
    const start = new Date(a.due_date + 'T00:00:00');
    if (!a.due_date_end || a.due_date_end === a.due_date) {
      return start.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const end = new Date(a.due_date_end + 'T00:00:00');
    const startStr = start.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
    const endStr = end.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }

  // ── Data access ──────────────────────────────────────────────
  async function fetchAssessmentsForMe() {
    if (!profile?.grade) return [];
    if (!isSubjectSetupComplete()) return [];
    let query = supabase().from('assessments').select('*').eq('grade', profile.grade);
    if (profile.grade >= 10) query = query.in('subject', mySubjects);
    const { data, error } = await query.order('due_date', { ascending: true, nullsFirst: false });
    if (error) { console.warn('[MagicLab] fetchAssessmentsForMe error:', error.message); return []; }
    let list = data || [];
    if (profile.grade < 10) {
      const allGroupSubjects = new Set(groupsForGrade(profile.grade).flatMap(g => g.options.flatMap(o => o.subjects)));
      const excluded = [...allGroupSubjects].filter(s => !mySubjects.includes(s));
      list = list.filter(a => !excluded.includes(a.subject));
    }
    return list;
  }

  async function fetchAllAssessments() {
    const { data, error } = await supabase().from('assessments').select('*').order('due_date', { ascending: true, nullsFirst: false });
    if (error) { console.warn('[MagicLab] fetchAllAssessments error:', error.message); return []; }
    return data || [];
  }

  async function fetchDistinctSubjects(grade) {
    const { data, error } = await supabase().from('assessments').select('subject').eq('grade', grade);
    if (error) { console.warn('[MagicLab] fetchDistinctSubjects error:', error.message); return []; }
    return [...new Set((data || []).map(r => r.subject))].sort();
  }

  async function saveMySubjects(subjects) {
    const { error } = await window.MagicLabAuth.updateProfile({ elective_subjects: subjects });
    if (!error) mySubjects = subjects;
    return { error };
  }

  function requireTeacher() {
    if (!window.MagicLabAuth.isTeacher()) return { error: { message: 'Only teachers can do that' } };
    return null;
  }

  async function addAssessment(row) {
    const denied = requireTeacher();
    if (denied) return denied;
    return supabase().from('assessments').insert({ ...row, created_by: profile.id }).select().single();
  }

  async function bulkAddAssessments(rows) {
    const denied = requireTeacher();
    if (denied) return denied;
    return supabase().from('assessments').insert(rows.map(r => ({ ...r, created_by: profile.id })));
  }

  async function getAllAssessments(grade) {
    let query = supabase().from('assessments').select('*');
    if (grade) query = query.eq('grade', grade);
    const { data, error } = await query.order('grade', { ascending: true }).order('due_date', { ascending: true, nullsFirst: false });
    if (error) { console.warn('[MagicLab] getAllAssessments error:', error.message); return []; }
    return data || [];
  }

  async function deleteAssessment(id) {
    const denied = requireTeacher();
    if (denied) return denied;
    return supabase().from('assessments').delete().eq('id', id);
  }

  // ── CSV / pasted-table parsing ───────────────────────────────
  // Columns: Grade, Subject, Type, Title, Due Date, Term, Description
  const VALID_TYPES = Object.keys(TYPE_LABELS);

  function parseCSVLine(line) {
    const cells = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
        else cur += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { cells.push(cur); cur = ''; }
      else cur += c;
    }
    cells.push(cur);
    return cells.map(c => c.trim());
  }

  function parseDateCell(raw) {
    if (!raw) return null;
    raw = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); // DD/MM/YYYY
    if (m) { const [, d, mo, y] = m; return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
    return null;
  }

  function normType(raw) {
    const t = (raw || '').trim().toLowerCase();
    return VALID_TYPES.includes(t) ? t : 'test';
  }

  function parseAssessmentText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows = [], errors = [];
    lines.forEach((line, idx) => {
      const cells = parseCSVLine(line);
      if (idx === 0 && /^grade$/i.test(cells[0] || '')) return; // skip header row
      const [gradeRaw, subject, typeRaw, title, dueRaw, termRaw, description] = cells;
      const lineNo = idx + 1;
      const grade = parseInt(gradeRaw, 10);
      if (!grade || grade < 8 || grade > 12) { errors.push(`Line ${lineNo}: grade must be 8-12 (got "${gradeRaw || ''}")`); return; }
      if (!subject) { errors.push(`Line ${lineNo}: subject is required`); return; }
      if (!title) { errors.push(`Line ${lineNo}: title is required`); return; }
      const due_date = dueRaw ? parseDateCell(dueRaw) : null;
      if (dueRaw && !due_date) { errors.push(`Line ${lineNo}: couldn't read date "${dueRaw}" — use YYYY-MM-DD or DD/MM/YYYY`); return; }
      rows.push({ grade, subject, type: normType(typeRaw), title, due_date, term: termRaw ? (parseInt(termRaw, 10) || null) : null, description: description || null });
    });
    return { rows, errors };
  }

  // ── Rendering: student-facing calendar ──────────────────────
  function renderSubjectPicker() {
    const wrap = document.getElementById('assess-subjects-wrap');
    if (!wrap) return;

    if (profile.grade < 10) {
      renderChoiceGroups(wrap);
      return;
    }

    if (mySubjects.length) {
      wrap.innerHTML = `
        <div class="assess-tags">${mySubjects.map(s => `<span class="subject-tag">${esc(s)}</span>`).join('')}</div>
        <button class="btn-ghost" id="assess-edit-subjects" style="margin-top:10px;">Change my subjects</button>`;
      document.getElementById('assess-edit-subjects').addEventListener('click', () => renderSubjectChooser(wrap));
      return;
    }

    renderSubjectChooser(wrap);
  }

  function renderSubjectChooser(wrap) {
    if (!availableSubjects.length) {
      wrap.innerHTML = `<div class="empty-hint">No Grade ${profile.grade} assessments have been uploaded yet — once your teachers add some, pick your subjects here.</div>`;
      return;
    }
    wrap.innerHTML = `
      <div class="section-sub" style="margin:0 0 10px;">Pick every subject you take this year — the calendar below will only show assessments for these.</div>
      <div class="day-toggles" id="assess-subject-checks">${availableSubjects.map(s => `<button type="button" class="day-btn" data-subject="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <button class="btn-primary" id="assess-save-subjects" style="margin-top:12px;">Save my subjects</button>
      <div class="msg" id="assess-subjects-msg"></div>`;

    const chosen = new Set(mySubjects);
    wrap.querySelectorAll('#assess-subject-checks .day-btn').forEach(btn => {
      btn.classList.toggle('active', chosen.has(btn.dataset.subject));
      btn.addEventListener('click', () => {
        const s = btn.dataset.subject;
        if (chosen.has(s)) chosen.delete(s); else chosen.add(s);
        btn.classList.toggle('active');
      });
    });
    document.getElementById('assess-save-subjects').addEventListener('click', async () => {
      const msg = document.getElementById('assess-subjects-msg');
      if (!chosen.size) { msg.textContent = 'Pick at least one subject.'; msg.className = 'msg err'; return; }
      const { error } = await saveMySubjects([...chosen]);
      if (error) { msg.textContent = error.message; msg.className = 'msg err'; return; }
      await renderAll();
    });
  }

  function renderChoiceGroups(wrap) {
    const groups = groupsForGrade(profile.grade);
    if (!groups.length) {
      wrap.innerHTML = `<div class="section-sub" style="margin:0 0 12px;">Grade ${profile.grade} takes every subject, so every Grade ${profile.grade} assessment below applies to you.</div>`;
      return;
    }
    wrap.innerHTML = groups.map((g, gi) => {
      const chosen = chosenOptionForGroup(g);
      if (chosen) {
        return `
          <div class="choice-group" style="margin-bottom:16px;">
            <div class="section-sub" style="margin:0 0 8px;">${esc(g.name)}:</div>
            <div class="assess-tags">${chosen.subjects.map(s => `<span class="subject-tag">${esc(s)}</span>`).join('')}</div>
            <button class="btn-ghost" data-change-group="${gi}" style="margin-top:8px;">Change</button>
          </div>`;
      }
      return `
        <div class="choice-group" style="margin-bottom:16px;">
          <div class="section-sub" style="margin:0 0 8px;">${esc(g.name)} — pick yours:</div>
          <div class="day-toggles" data-pick-group="${gi}">${g.options.map((o, oi) => `<button type="button" class="day-btn" data-option="${oi}">${esc(o.label)}</button>`).join('')}</div>
        </div>`;
    }).join('') + '<div class="msg" id="assess-choice-msg"></div>';

    wrap.querySelectorAll('[data-pick-group]').forEach(el => {
      const group = groups[parseInt(el.dataset.pickGroup, 10)];
      el.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const option = group.options[parseInt(btn.dataset.option, 10)];
          const groupSubjects = new Set(group.options.flatMap(o => o.subjects));
          const { error } = await saveMySubjects([...mySubjects.filter(s => !groupSubjects.has(s)), ...option.subjects]);
          const msg = document.getElementById('assess-choice-msg');
          if (error) { msg.textContent = error.message; msg.className = 'msg err'; return; }
          await renderAll();
        });
      });
    });
    wrap.querySelectorAll('[data-change-group]').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = groups[parseInt(btn.dataset.changeGroup, 10)];
        const groupSubjects = new Set(group.options.flatMap(o => o.subjects));
        mySubjects = mySubjects.filter(s => !groupSubjects.has(s));
        renderChoiceGroups(wrap);
        renderList();
      });
    });
  }

  function renderAssessmentItems(list, { showGrade = false } = {}) {
    const box = document.getElementById('assess-list');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = viewMode === 'all'
        ? '<div class="empty-hint">Nothing on the calendar yet — check back once teachers add assessments.</div>'
        : '<div class="empty-hint">Nothing on the calendar yet — check back once your teachers add assessments.</div>';
      return;
    }
    box.innerHTML = list.map(a => {
      const ranged = a.due_date_end && a.due_date_end !== a.due_date;
      const today = isDueToday(a);
      const startDays = daysUntil(a.due_date);
      const endDays = daysUntil(a.due_date_end || a.due_date);
      const overdue = endDays !== null && endDays < 0;
      const dateClass = startDays === null ? 'none' : overdue ? 'overdue' : '';
      const badge = today ? (ranged ? 'Due now' : 'Today')
        : (startDays !== null && startDays > 0 && startDays <= 7 ? (startDays === 1 ? 'Tomorrow' : `In ${startDays} days`) : '');
      return `
      <div class="upcoming-item">
        <div class="upcoming-date ${dateClass}">${fmtDateRange(a)}</div>
        <div class="upcoming-body">
          <div class="upcoming-title">${esc(a.title)}</div>
          <div class="upcoming-meta">
            ${showGrade ? `<span class="subject-tag">Gr ${a.grade}</span>` : ''}
            <span class="subject-tag">${esc(a.subject)}</span>
            <span class="type-tag subject-tag">${esc(TYPE_LABELS[a.type] || a.type)}</span>
            ${ranged ? `<span class="type-tag subject-tag">${a._windowCount}-day window</span>` : ''}
            ${badge ? `<span class="type-tag subject-tag" style="color:#fca5a5;border-color:rgba(248,113,113,0.3);">${esc(badge)}</span>` : ''}
          </div>
          ${a.description ? `<div class="upcoming-meta" style="margin-top:4px;">${esc(a.description)}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  /** A quick "due today" highlight, scoped to the learner's own subjects
   * regardless of the subject-filter dropdown — that filter is for
   * browsing, this is meant to always show everything relevant today. */
  function renderTodayBanner(list) {
    const box = document.getElementById('assess-today');
    if (!box) return;
    const todayItems = list.filter(a => isDueToday(a));
    if (!todayItems.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="today-banner-title">📌 Due today</div>
      ${todayItems.map(a => `
        <div class="today-banner-item">
          <span class="subject-tag">${esc(a.subject)}</span>
          <span class="type-tag subject-tag">${esc(TYPE_LABELS[a.type] || a.type)}</span>
          <span class="today-banner-text">${esc(a.title)}</span>
        </div>`).join('')}`;
  }

  function populateSubjectFilter(list) {
    const select = document.getElementById('assess-subject-filter');
    if (!select) return;
    const subjects = [...new Set(list.map(a => a.subject))].sort();
    const previous = subjectFilter;
    select.innerHTML = '<option value="">All subjects</option>' + subjects.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if (previous && subjects.includes(previous)) { select.value = previous; subjectFilter = previous; }
    else { select.value = ''; subjectFilter = ''; }
  }

  async function renderList() {
    const box = document.getElementById('assess-list');
    if (viewMode === 'all') {
      document.getElementById('assess-today').classList.add('hidden');
      const list = groupWindows(await fetchAllAssessments());
      populateSubjectFilter(list);
      const filtered = subjectFilter ? list.filter(a => a.subject === subjectFilter) : list;
      renderAssessmentItems(filtered, { showGrade: true });
      return;
    }
    if (!isSubjectSetupComplete()) {
      box.innerHTML = '<div class="empty-hint">Choose your subjects above to see your assessment calendar.</div>';
      populateSubjectFilter([]);
      document.getElementById('assess-today').classList.add('hidden');
      return;
    }
    const list = groupWindows(await fetchAssessmentsForMe());
    renderTodayBanner(list);
    populateSubjectFilter(list);
    const filtered = subjectFilter ? list.filter(a => a.subject === subjectFilter) : list;
    renderAssessmentItems(filtered, { showGrade: false });
  }

  function setViewMode(mode) {
    viewMode = mode;
    document.querySelectorAll('#assess-view-toggle .timemode-btn').forEach(b => b.classList.toggle('active', b.dataset.assessview === mode));
    renderList();
  }

  async function renderAll() {
    document.getElementById('assess-list').classList.remove('hidden');
    document.getElementById('assess-controls-row').classList.remove('hidden');
    availableSubjects = profile.grade >= 10 ? await fetchDistinctSubjects(profile.grade) : [];
    renderSubjectPicker();
    await renderList();
    window.lucide?.createIcons();
  }

  // ── Teacher admin panel ──────────────────────────────────────
  function renderAdminPanel() {
    const panel = document.getElementById('assess-admin');
    if (!panel) return;
    if (!window.MagicLabAuth.isTeacher()) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    wireAdminForms();
    refreshManageList();
  }

  function wireAdminForms() {
    document.getElementById('aa-submit').addEventListener('click', async () => {
      const msg = document.getElementById('aa-msg');
      const grade = parseInt(document.getElementById('aa-grade').value, 10);
      const subject = document.getElementById('aa-subject').value.trim();
      const type = document.getElementById('aa-type').value;
      const title = document.getElementById('aa-title').value.trim();
      const due_date = document.getElementById('aa-due').value || null;
      const term = document.getElementById('aa-term').value ? parseInt(document.getElementById('aa-term').value, 10) : null;
      const description = document.getElementById('aa-desc').value.trim() || null;
      if (!subject || !title) { msg.textContent = 'Subject and title are required.'; msg.className = 'msg err'; return; }

      const { error } = await addAssessment({ grade, subject, type, title, due_date, term, description });
      if (error) { msg.textContent = error.message; msg.className = 'msg err'; return; }
      msg.textContent = 'Added.'; msg.className = 'msg ok';
      ['aa-subject', 'aa-title', 'aa-due', 'aa-term', 'aa-desc'].forEach(id => { document.getElementById(id).value = ''; });
      refreshManageList();
    });

    document.getElementById('aa-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { document.getElementById('aa-bulk-text').value = reader.result; };
      reader.readAsText(file);
    });

    document.getElementById('aa-preview').addEventListener('click', () => {
      const text = document.getElementById('aa-bulk-text').value;
      const { rows, errors } = parseAssessmentText(text);
      _pendingBulkRows = rows;
      const box = document.getElementById('aa-bulk-preview');
      const parts = [];
      if (rows.length) parts.push(`<div class="msg ok">${rows.length} row${rows.length === 1 ? '' : 's'} ready to upload.</div>`);
      if (errors.length) parts.push(`<div class="msg err">${errors.length} problem${errors.length === 1 ? '' : 's'}:<br>${errors.map(esc).join('<br>')}</div>`);
      if (!rows.length && !errors.length) parts.push('<div class="msg err">Nothing to upload — paste rows or choose a file first.</div>');
      box.innerHTML = parts.join('');
      document.getElementById('aa-bulk-submit').classList.toggle('hidden', !rows.length);
    });

    document.getElementById('aa-bulk-submit').addEventListener('click', async () => {
      const msg = document.getElementById('aa-bulk-preview');
      if (!_pendingBulkRows.length) return;
      const { error } = await bulkAddAssessments(_pendingBulkRows);
      if (error) { msg.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return; }
      msg.innerHTML = `<div class="msg ok">Uploaded ${_pendingBulkRows.length} assessments.</div>`;
      document.getElementById('aa-bulk-text').value = '';
      document.getElementById('aa-file').value = '';
      document.getElementById('aa-bulk-submit').classList.add('hidden');
      _pendingBulkRows = [];
      refreshManageList();
    });

    document.getElementById('aa-manage-grade').addEventListener('change', refreshManageList);
  }

  let _pendingBulkRows = [];

  // Which month groups are expanded in the manage-assessments list.
  // Seeded with the real current month so a teacher lands on "what's
  // due soon" instead of scrolling a flat list back to the top of the
  // year; toggles persist across refreshes (adding/deleting an
  // assessment shouldn't collapse whatever the teacher had open).
  function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const expandedMonths = new Set([currentMonthKey()]);
  function monthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
  }

  async function refreshManageList() {
    const gradeVal = document.getElementById('aa-manage-grade').value;
    const list = await getAllAssessments(gradeVal ? parseInt(gradeVal, 10) : null);
    const box = document.getElementById('aa-manage-list');
    if (!list.length) { box.innerHTML = '<div class="empty-hint">No assessments yet.</div>'; return; }

    const dated = list.filter(a => a.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date) || a.grade - b.grade);
    const undated = list.filter(a => !a.due_date);

    const byMonth = new Map();
    dated.forEach(a => {
      const key = a.due_date.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(a);
    });
    const monthKeys = [...byMonth.keys()].sort();

    // If nothing currently expanded still exists in this (possibly
    // grade-filtered) list, fall back to the nearest month ahead, or
    // else the most recent one — better than everything defaulting shut.
    const stillValid = [...expandedMonths].some(k => byMonth.has(k) || (k === 'no-date' && undated.length));
    if (!stillValid) {
      const nowKey = currentMonthKey();
      const fallback = monthKeys.find(k => k >= nowKey) || monthKeys[monthKeys.length - 1];
      if (fallback) expandedMonths.add(fallback);
    }

    function renderRow(a) {
      return `
        <div class="admin-list-row">
          <div>
            <div class="admin-list-title">Gr ${a.grade} · ${esc(a.subject)} · ${esc(TYPE_LABELS[a.type] || a.type)} — ${esc(a.title)}</div>
            <div class="admin-list-meta">${fmtDate(a.due_date) || 'No date'}${a.term ? ` · Term ${a.term}` : ''}</div>
          </div>
          <button class="btn-ghost danger" data-del-assess="${a.id}" title="Delete"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
        </div>`;
    }
    function renderGroup(key, label, items) {
      const open = expandedMonths.has(key);
      return `
        <div class="admin-month-group">
          <button type="button" class="admin-month-header" data-month-toggle="${key}">
            <i data-lucide="chevron-${open ? 'down' : 'right'}" style="width:14px;height:14px;flex-shrink:0;"></i>
            <span>${esc(label)}</span>
            <span class="admin-month-count">${items.length}</span>
          </button>
          <div class="admin-month-body${open ? '' : ' hidden'}">${items.map(renderRow).join('')}</div>
        </div>`;
    }

    box.innerHTML = monthKeys.map(key => renderGroup(key, monthLabel(key), byMonth.get(key))).join('')
      + (undated.length ? renderGroup('no-date', 'No date', undated) : '');

    box.querySelectorAll('[data-month-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.monthToggle;
        if (expandedMonths.has(key)) expandedMonths.delete(key); else expandedMonths.add(key);
        refreshManageList();
      });
    });
    box.querySelectorAll('[data-del-assess]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this assessment?')) return;
        await deleteAssessment(btn.dataset.delAssess);
        refreshManageList();
      });
    });
    window.lucide?.createIcons();
  }

  async function init() {
    profile = window.MagicLabAuth.getProfile();
    renderAdminPanel();

    document.querySelectorAll('#assess-view-toggle .timemode-btn').forEach(btn => {
      btn.addEventListener('click', () => setViewMode(btn.dataset.assessview));
    });

    document.getElementById('assess-subject-filter').addEventListener('change', (e) => {
      subjectFilter = e.target.value;
      renderList();
    });

    if (!profile?.grade) {
      // Teachers (and any account with no grade on file) have nothing
      // personal to show here — the admin tools above are their view.
      const note = window.MagicLabAuth.isTeacher()
        ? 'Use the teacher tools below to manage the calendar.'
        : 'Add your grade in My Account to see your assessment calendar.';
      document.getElementById('assess-subjects-wrap').innerHTML = `<div class="empty-hint">${note}</div>`;
      document.getElementById('assess-list').classList.add('hidden');
      return;
    }

    mySubjects = profile.elective_subjects || [];
    await renderAll();
  }

  window.TimeTurnerAssessments = { init };
})();
