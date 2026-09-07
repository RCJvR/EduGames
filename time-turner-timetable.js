// ============================================================
// THE MAGIC LAB — time-turner-timetable.js
// Bulk timetable upload for Time Turner, instead of adding all 60
// periods (10 days × 6 periods) one at a time through "Add a block".
//
// Two destinations, one shared row format ({ "1": [p1..p6], ... }):
//   - Personal: any signed-in profile (student OR teacher — a teacher's
//     own teaching timetable works exactly the same way) uploads their
//     own, which is turned straight into their Time Turner entries via
//     window.TimeTurner.importScheduleFromGrid(). No table of our own —
//     it lands in the existing planner_entries row.
//   - Class-shared: a teacher uploads one timetable per class they own
//     (the class_timetables table), and a student who's a member of
//     that class can one-click import it into their own plan the same
//     way. Deliberately per CLASS, not per grade — different register
//     classes in the same grade (8A1, 8A2, ...) rotate through
//     different rooms/specialist subjects, so a whole grade never
//     shares one timetable at this school.
//
// Requires auth.js, time-turner.js and time-turner-periods.js (for the
// period-time lookup importScheduleFromGrid itself uses). Include after
// all three.
// ============================================================

(function () {
  let profile = null;

  function supabase() { return window.MagicLabAuth._supabase(); }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── Shared "Day, P1, P2, P3, P4, P5, P6" parsing ────────────────
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

  function parseTimetableText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const grid = {};
    const errors = [];
    lines.forEach((line, idx) => {
      const cells = parseCSVLine(line);
      if (idx === 0 && /^day$/i.test(cells[0] || '')) return; // skip an optional header row
      const lineNo = idx + 1;
      const day = parseInt(cells[0], 10);
      if (!day || day < 1 || day > 10) { errors.push(`Line ${lineNo}: day must be 1-10 (got "${cells[0] || ''}")`); return; }
      const subjects = cells.slice(1, 7).map(c => (c || '').trim());
      while (subjects.length < 6) subjects.push('');
      grid[day] = subjects;
    });
    return { grid, errors };
  }

  function gridFilledCount(grid) {
    return Object.values(grid || {}).reduce((sum, row) => sum + row.filter(s => s).length, 0);
  }

  function importResultMessage({ imported, skipped }) {
    if (skipped > 0) return `Added ${imported} period${imported === 1 ? '' : 's'} to your plan — skipped ${skipped} because period times aren't set up yet for that day type (see "Period times" above).`;
    return `Added ${imported} period${imported === 1 ? '' : 's'} to your plan.`;
  }

  // ── Personal upload (student's own, or a teacher's own teaching timetable) ──
  function wirePersonalUpload() {
    const fileInput = document.getElementById('tt-file');
    const textArea = document.getElementById('tt-text');
    const previewBtn = document.getElementById('tt-preview-btn');
    const submitBtn = document.getElementById('tt-submit-btn');
    const previewBox = document.getElementById('tt-preview-box');
    const msg = document.getElementById('tt-msg');
    if (!fileInput) return;

    let pendingGrid = null;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { textArea.value = reader.result; };
      reader.readAsText(file);
    });

    previewBtn.addEventListener('click', () => {
      const { grid, errors } = parseTimetableText(textArea.value);
      pendingGrid = grid;
      const filled = gridFilledCount(grid);
      const parts = [];
      if (filled) parts.push(`<div class="msg ok">${filled} period${filled === 1 ? '' : 's'} across ${Object.keys(grid).length} day${Object.keys(grid).length === 1 ? '' : 's'} ready to add.</div>`);
      if (errors.length) parts.push(`<div class="msg err">${errors.length} problem${errors.length === 1 ? '' : 's'}:<br>${errors.map(esc).join('<br>')}</div>`);
      if (!filled && !errors.length) parts.push('<div class="msg err">Nothing to add — paste rows or choose a file first.</div>');
      previewBox.innerHTML = parts.join('');
      submitBtn.classList.toggle('hidden', !filled);
    });

    submitBtn.addEventListener('click', () => {
      if (!pendingGrid) return;
      const result = window.TimeTurner.importScheduleFromGrid(pendingGrid);
      msg.textContent = importResultMessage(result);
      msg.className = result.skipped ? 'msg' : 'msg ok';
      textArea.value = '';
      fileInput.value = '';
      previewBox.innerHTML = '';
      submitBtn.classList.add('hidden');
      pendingGrid = null;
    });
  }

  // ── "Import my class's timetable" convenience ───────────────────
  async function fetchMyClassMemberships() {
    const { data: memberships, error: memErr } = await supabase().from('class_members').select('class_id').eq('student_id', profile.id);
    if (memErr || !memberships?.length) return [];
    const classIds = [...new Set(memberships.map(m => m.class_id))];
    const { data: classes, error: classErr } = await supabase().from('classes').select('id, name, grade').in('id', classIds);
    if (classErr) return [];
    return classes || [];
  }

  async function wireClassImport() {
    const box = document.getElementById('tt-import-class-box');
    if (!box) return;
    const myClasses = await fetchMyClassMemberships();
    if (!myClasses.length) return;

    const { data: rows, error } = await supabase().from('class_timetables').select('class_id, grid').in('class_id', myClasses.map(c => c.id));
    if (error || !rows?.length) return;

    const available = rows
      .map(r => ({ ...r, cls: myClasses.find(c => c.id === r.class_id) }))
      .filter(r => r.cls && gridFilledCount(r.grid) > 0);
    if (!available.length) return;

    document.getElementById('tt-import-class-list').innerHTML = available.map(r => `
      <button class="btn-primary" data-import-class="${r.class_id}" type="button" style="margin:0 8px 8px 0;">
        <i data-lucide="download" style="width:14px;height:14px;"></i>Import ${esc(r.cls.name)}'s timetable
      </button>`).join('');
    box.classList.remove('hidden');

    box.querySelectorAll('[data-import-class]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = available.find(r => r.class_id === btn.dataset.importClass);
        const result = window.TimeTurner.importScheduleFromGrid(row.grid);
        const msg = document.getElementById('tt-import-class-msg');
        msg.textContent = importResultMessage(result);
        msg.className = result.skipped ? 'msg' : 'msg ok';
      });
    });
    window.lucide?.createIcons();
  }

  // ── Teacher admin: upload a class's shared timetable ────────────
  function requireTeacher() {
    if (!window.MagicLabAuth.isTeacher()) return { error: { message: 'Only teachers can do that' } };
    return null;
  }

  async function fetchMyClasses() {
    const { data, error } = await supabase().from('classes').select('id, name, grade').eq('teacher_id', profile.id).order('name', { ascending: true });
    if (error) { console.warn('[MagicLab] fetchMyClasses error:', error.message); return []; }
    return data || [];
  }

  async function saveClassTimetable(classId, grid) {
    const denied = requireTeacher();
    if (denied) return denied;
    return supabase().from('class_timetables').upsert({ class_id: classId, grid, updated_by: profile.id, updated_at: new Date().toISOString() });
  }

  async function deleteClassTimetable(classId) {
    const denied = requireTeacher();
    if (denied) return denied;
    return supabase().from('class_timetables').delete().eq('class_id', classId);
  }

  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }

  function renderGridRows(grid) {
    return Array.from({ length: 10 }, (_, i) => i + 1).map(day => {
      const row = grid[day] || grid[String(day)] || [];
      const text = row.some(s => s) ? row.map(s => s || '—').join(' · ') : null;
      if (!text) return '';
      return `<div class="admin-list-meta" style="padding:3px 0;">Day ${day}: ${esc(text)}</div>`;
    }).join('');
  }

  let _myClasses = [];

  async function refreshAdminTimetableList() {
    const box = document.getElementById('tt-admin-list');
    if (!box) return;
    if (!_myClasses.length) { box.innerHTML = '<div class="empty-hint">You don\'t have any classes set up yet — add one first, then come back here to upload its timetable.</div>'; return; }

    const { data: rows, error } = await supabase().from('class_timetables').select('*').in('class_id', _myClasses.map(c => c.id));
    if (error) { box.innerHTML = '<div class="empty-hint">Couldn\'t load class timetables.</div>'; return; }
    const withTimetable = (rows || []).map(r => ({ ...r, cls: _myClasses.find(c => c.id === r.class_id) })).filter(r => r.cls && gridFilledCount(r.grid) > 0);
    if (!withTimetable.length) { box.innerHTML = '<div class="empty-hint">No timetables uploaded yet for your classes.</div>'; return; }

    box.innerHTML = withTimetable.map(r => `
      <div class="admin-month-group">
        <button type="button" class="admin-month-header" data-tt-view="${r.class_id}">
          <i data-lucide="chevron-right" style="width:14px;height:14px;flex-shrink:0;"></i>
          <span>${esc(r.cls.name)}${r.cls.grade ? ` (Gr ${r.cls.grade})` : ''}</span>
          <span class="admin-month-count">${fmtDate(r.updated_at)}</span>
        </button>
        <div class="admin-month-body hidden" id="tt-admin-grid-${r.class_id}">
          ${renderGridRows(r.grid || {})}
          <button class="btn-ghost danger" data-tt-delete="${r.class_id}" style="margin-top:8px;"><i data-lucide="trash-2" style="width:13px;height:13px;"></i>Delete ${esc(r.cls.name)}'s timetable</button>
        </div>
      </div>`).join('');

    box.querySelectorAll('[data-tt-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const body = document.getElementById(`tt-admin-grid-${btn.dataset.ttView}`);
        const icon = btn.querySelector('i');
        const nowHidden = body.classList.toggle('hidden');
        icon.setAttribute('data-lucide', nowHidden ? 'chevron-right' : 'chevron-down');
        window.lucide?.createIcons();
      });
    });
    box.querySelectorAll('[data-tt-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cls = _myClasses.find(c => c.id === btn.dataset.ttDelete);
        if (!confirm(`Delete ${cls?.name || 'this class'}'s timetable? Students will no longer be able to import it.`)) return;
        await deleteClassTimetable(btn.dataset.ttDelete);
        refreshAdminTimetableList();
      });
    });
    window.lucide?.createIcons();
  }

  async function wireAdminUpload() {
    const classSelect = document.getElementById('tt-admin-class');
    const fileInput = document.getElementById('tt-admin-file');
    const textArea = document.getElementById('tt-admin-text');
    const previewBtn = document.getElementById('tt-admin-preview-btn');
    const submitBtn = document.getElementById('tt-admin-submit-btn');
    const previewBox = document.getElementById('tt-admin-preview-box');
    if (!classSelect) return;

    _myClasses = await fetchMyClasses();
    classSelect.innerHTML = _myClasses.length
      ? _myClasses.map(c => `<option value="${c.id}">${esc(c.name)}${c.grade ? ` (Gr ${c.grade})` : ''}</option>`).join('')
      : '<option value="">No classes yet</option>';

    let pendingGrid = null;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { textArea.value = reader.result; };
      reader.readAsText(file);
    });

    previewBtn.addEventListener('click', () => {
      const { grid, errors } = parseTimetableText(textArea.value);
      pendingGrid = grid;
      const filled = gridFilledCount(grid);
      const parts = [];
      if (filled) parts.push(`<div class="msg ok">${filled} period${filled === 1 ? '' : 's'} across ${Object.keys(grid).length} day${Object.keys(grid).length === 1 ? '' : 's'} ready to upload.</div>`);
      if (errors.length) parts.push(`<div class="msg err">${errors.length} problem${errors.length === 1 ? '' : 's'}:<br>${errors.map(esc).join('<br>')}</div>`);
      if (!filled && !errors.length) parts.push('<div class="msg err">Nothing to upload — paste rows or choose a file first.</div>');
      previewBox.innerHTML = parts.join('');
      submitBtn.classList.toggle('hidden', !filled);
    });

    submitBtn.addEventListener('click', async () => {
      if (!pendingGrid || !classSelect.value) return;
      const cls = _myClasses.find(c => c.id === classSelect.value);
      const { error } = await saveClassTimetable(classSelect.value, pendingGrid);
      if (error) { previewBox.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return; }
      previewBox.innerHTML = `<div class="msg ok">Saved ${esc(cls?.name || 'this class')}'s timetable.</div>`;
      textArea.value = '';
      fileInput.value = '';
      submitBtn.classList.add('hidden');
      pendingGrid = null;
      refreshAdminTimetableList();
    });
  }

  async function init() {
    profile = window.MagicLabAuth.getProfile();
    wirePersonalUpload();
    wireClassImport();
    if (window.MagicLabAuth.isTeacher()) {
      await wireAdminUpload();
      refreshAdminTimetableList();
    }
  }

  window.TimeTurnerTimetable = { init };
})();
