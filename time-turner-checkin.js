// ============================================================
// THE MAGIC LAB — time-turner-checkin.js
// Teacher-facing "check on a learner" tool. Two independent data
// sources, both already access-controlled elsewhere in the app:
//   - Assessment load: the school-wide assessment calendar, already
//     readable by any signed-in user (see time-turner-assessments.js).
//   - Wellbeing signals: planner_summaries, readable only for a
//     student already in one of this teacher's classes
//     (teacher_has_student(), the same function that already gates
//     reading that student's profile).
// Requires require-auth.js. Include after auth.js.
// ============================================================

(function () {
  const TYPE_LABELS = { test: 'Test', exam: 'Exam', assignment: 'Assignment', project: 'Project', practical: 'Practical', other: 'Other' };
  let students = [];
  let selected = null;

  function supabase() { return window.MagicLabAuth._supabase(); }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtDate(d) {
    return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : 'No date';
  }

  async function fetchMyStudents() {
    const profile = window.MagicLabAuth.getProfile();
    const sb = supabase();
    const { data: classes, error: classErr } = await sb.from('classes').select('id, name, grade, subject').eq('teacher_id', profile.id);
    if (classErr || !classes?.length) return [];

    const classIds = classes.map(c => c.id);
    const { data: members, error: memErr } = await sb.from('class_members').select('student_id, class_id').in('class_id', classIds);
    if (memErr || !members?.length) return [];

    const studentIds = [...new Set(members.map(m => m.student_id))];
    const { data: profiles, error: profErr } = await sb.from('profiles').select('id, display_name, grade, elective_subjects').in('id', studentIds);
    if (profErr) return [];

    const classNameById = Object.fromEntries(classes.map(c => [c.id, c.name]));
    const classesByStudent = {};
    members.forEach(m => { (classesByStudent[m.student_id] = classesByStudent[m.student_id] || []).push(classNameById[m.class_id]); });

    return (profiles || [])
      .map(p => ({ ...p, classNames: [...new Set(classesByStudent[p.id] || [])] }))
      .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
  }

  function renderStudentList(filter) {
    const box = document.getElementById('student-list');
    if (!students.length) { box.innerHTML = '<div class="empty-hint">No learners found in your classes yet.</div>'; return; }

    const q = (filter || '').trim().toLowerCase();
    const filtered = q ? students.filter(s => (s.display_name || '').toLowerCase().includes(q)) : students;
    if (!filtered.length) { box.innerHTML = '<div class="empty-hint">No match.</div>'; return; }

    box.innerHTML = filtered.map(s => `
      <div class="entry-row clickable${selected?.id === s.id ? ' active' : ''}" data-student="${esc(s.id)}">
        <div class="entry-emoji">🎓</div>
        <div class="entry-body">
          <div class="entry-title">${esc(s.display_name || 'Unnamed learner')}</div>
          <div class="entry-meta">Grade ${esc(s.grade ?? '?')} · ${esc(s.classNames.join(', ') || 'No class')}</div>
        </div>
      </div>`).join('');

    box.querySelectorAll('[data-student]').forEach(row => {
      row.addEventListener('click', () => selectStudent(row.dataset.student));
    });
  }

  async function fetchAssessmentLoad(student, days) {
    if (student.grade >= 10 && !student.elective_subjects?.length) {
      return { count: 0, list: [], note: "This learner hasn't chosen their subjects yet, so their personal assessment load can't be filtered — check the whole-grade calendar in Manage Assessments instead." };
    }
    const sb = supabase();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(today); end.setDate(end.getDate() + days);
    const fmt = d => d.toISOString().slice(0, 10);

    let q = sb.from('assessments').select('*').eq('grade', student.grade).gte('due_date', fmt(today)).lte('due_date', fmt(end));
    if (student.grade >= 10) q = q.in('subject', student.elective_subjects);
    const { data, error } = await q.order('due_date', { ascending: true });
    if (error) return { count: 0, list: [], note: error.message };
    return { count: (data || []).length, list: data || [] };
  }

  function renderAssessmentLoad(result, days) {
    const box = document.getElementById('assess-load-card');
    if (result.note) { box.innerHTML = `<div class="empty-hint">${esc(result.note)}</div>`; return; }
    if (!result.count) { box.innerHTML = `<div class="empty-hint">Nothing due in the next ${days} days.</div>`; return; }
    box.innerHTML = `
      <div class="stat-big">${result.count} <small>due in the next ${days} days</small></div>
      ${result.list.map(a => `
        <div class="entry-row">
          <div class="entry-emoji">📝</div>
          <div class="entry-body">
            <div class="entry-title">${esc(a.subject)} — ${esc(a.title)}</div>
            <div class="entry-meta">${esc(TYPE_LABELS[a.type] || a.type)} · ${fmtDate(a.due_date)}</div>
          </div>
        </div>`).join('')}`;
  }

  async function fetchWellbeing(studentId) {
    const sb = supabase();
    const { data, error } = await sb.from('planner_summaries').select('*').eq('student_id', studentId).maybeSingle();
    if (error || !data) return { available: false };
    return { available: true, updatedAt: data.updated_at, minutes: data.weekly_minutes || {} };
  }

  /** Mirrors the thresholds in time-turner.js's own computeInsights()
   * so a learner never sees a different bar applied behind their back. */
  function computeFlags(m) {
    const flags = [];
    const sleepPerNight = (m.rest || 0) / 7 / 60;
    if (!m.rest) flags.push({ icon: '😴', text: 'No sleep/rest blocks logged in their plan.' });
    else if (sleepPerNight < 7.5) flags.push({ icon: '😴', text: `Sleep averages about ${sleepPerNight.toFixed(1)} h/night in their plan (teens need roughly 8–10h).` });

    const freeHours = (m.free || 0) / 60;
    if (freeHours < 3) flags.push({ icon: '🎮', text: `Very little unstructured free time logged (about ${freeHours.toFixed(1)}h/week).` });

    if (!m.extracurricular) flags.push({ icon: '🏅', text: 'No extracurricular/exercise time logged.' });
    if (!m.family) flags.push({ icon: '❤️', text: 'No family time logged.' });
    if (!m.chores) flags.push({ icon: '🧹', text: 'No chores time logged.' });
    if (!m.meals) flags.push({ icon: '🍽️', text: 'No meal times logged.' });
    return flags;
  }

  function renderWellbeing(result) {
    const box = document.getElementById('wellbeing-card');
    if (!result.available) {
      box.innerHTML = '<div class="empty-hint">This learner hasn\'t used their personal planner yet — no data available.</div>';
      return;
    }
    const flags = computeFlags(result.minutes);
    const updated = new Date(result.updatedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
    const flagsHtml = flags.length
      ? flags.map(f => `<div class="tip"><span class="tip-icon">${f.icon}</span><span>${esc(f.text)}</span></div>`).join('')
      : '<div class="tip"><span class="tip-icon">✅</span><span>Their logged plan looks balanced — no signals flagged.</span></div>';
    box.innerHTML = `${flagsHtml}<div class="section-sub" style="margin-top:10px;">Last updated ${updated}, from their own plan.</div>`;
  }

  async function selectStudent(id) {
    selected = students.find(s => s.id === id);
    if (!selected) return;

    document.getElementById('student-detail').classList.remove('hidden');
    document.querySelectorAll('#student-list .entry-row').forEach(r => r.classList.toggle('active', r.dataset.student === id));
    document.getElementById('detail-name').textContent = selected.display_name || 'Unnamed learner';
    document.getElementById('assess-load-card').innerHTML = '<div class="empty-hint">Loading…</div>';
    document.getElementById('wellbeing-card').innerHTML = '<div class="empty-hint">Loading…</div>';

    const days = Number(document.getElementById('assess-days').value || 14);
    const [load, wellbeing] = await Promise.all([fetchAssessmentLoad(selected, days), fetchWellbeing(selected.id)]);
    renderAssessmentLoad(load, days);
    renderWellbeing(wellbeing);
  }

  async function init() {
    if (!window.MagicLabAuth.isTeacher()) {
      document.getElementById('not-teacher').classList.remove('hidden');
      return;
    }
    document.getElementById('teacher-tool').classList.remove('hidden');

    students = await fetchMyStudents();
    renderStudentList('');

    document.getElementById('student-search').addEventListener('input', (e) => renderStudentList(e.target.value));
    document.getElementById('assess-days').addEventListener('change', () => { if (selected) selectStudent(selected.id); });
    window.lucide?.createIcons();
  }

  window.TimeTurnerCheckin = { init };
})();
