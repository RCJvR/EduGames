// ============================================================
// THE MAGIC LAB — time-turner.js
// A private time-management planner. Entries live only in this
// browser's localStorage — there's nothing to share between students or
// teachers here, so there's no Supabase table for it.
//
// Two ways an entry can repeat, because school timetables and daily life
// don't run on the same clock:
//   - 'weekly'  — same weekday(s) every single week (practices, meals,
//                 chores, sleep, weekly tests). Applies identically to
//                 both weeks shown.
//   - 'cycle'   — tied to a specific day of a 10-day rotating school
//                 timetable (e.g. Day 3, Day 7). Cycle days 1–5 map onto
//                 Week 1's Mon–Fri and days 6–10 onto Week 2's Mon–Fri,
//                 so a 10-day cycle is always exactly two calendar weeks.
// Both kinds are shown together across the same two-week view so a
// Friday early finish (whichever cycle days land on a Friday) and a
// Tuesday-afternoon practice both show up in the right place.
// ============================================================

(function () {
  const STORAGE_KEY = 'ml-time-turner-entries-v2';
  const OLD_STORAGE_KEY = 'ml-time-turner-entries-v1';
  const NAME_KEY = 'ml-time-turner-name';
  const ANCHOR_KEY = 'ml-time-turner-anchor-date';
  const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_MIN = 1440;
  const SLOT_COUNT = 14; // two 7-day weeks
  const PX_PER_MIN = 0.5; // 720px-tall grid, one hour = 30px

  const CATEGORIES = {
    school:          { label: 'School / Academics',      emoji: '🎓', color: '#60a5fa' },
    homework:        { label: 'Homework / Study',        emoji: '📚', color: '#a78bfa' },
    extracurricular: { label: 'Extracurricular / Exercise', emoji: '🏅', color: '#fb923c' },
    family:          { label: 'Family time',              emoji: '❤️', color: '#e879f9' },
    meals:           { label: 'Meals',                    emoji: '🍽️', color: '#fbbf24' },
    chores:          { label: 'Chores / Cleaning up',     emoji: '🧹', color: '#2dd4bf' },
    rest:            { label: 'Rest / Sleep',             emoji: '😴', color: '#818cf8' },
    free:            { label: 'Free time / Recreation',   emoji: '🎮', color: '#4ade80' },
    other:           { label: 'Other',                    emoji: '⭐', color: '#94a3b8' }
  };

  let entries = [];
  let recurrence = 'weekly'; // 'weekly' | 'cycle' — which day-picker the add form is showing
  let selectedWeekdays = new Set();
  let selectedCycleDays = new Set();

  // ── Cycle <-> slot mapping ───────────────────────────────────
  // Slot 0-6 = Week 1 Mon..Sun, slot 7-13 = Week 2 Mon..Sun.
  function cycleDayToSlot(d) {
    const week = d <= 5 ? 0 : 1;
    const weekday = (d - 1) % 5; // 0..4, Mon..Fri
    return week * 7 + weekday;
  }
  function slotCycleDay(slot) {
    const weekday = slot % 7, week = Math.floor(slot / 7);
    if (weekday > 4) return null; // Sat/Sun aren't timetable days
    return week * 5 + weekday + 1;
  }
  function slotLabel(slot) {
    const weekday = slot % 7, week = Math.floor(slot / 7);
    const cd = slotCycleDay(slot);
    return cd ? `${DAY_FULL[weekday]} (Day ${cd})` : `${DAY_FULL[weekday]} (Week ${week + 1})`;
  }

  function loadEntries() {
    try { entries = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { entries = []; }
    if (!entries.length) {
      // Migrate the old single-week format (days: [0-6], no recurrence) if present.
      try {
        const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
        if (Array.isArray(old) && old.length) {
          entries = old.map(e => ({ ...e, recurrence: 'weekly', weekdays: e.days || [] }));
          delete_deprecated_days_field();
          saveEntries();
        }
      } catch (e) {}
    }
    function delete_deprecated_days_field() { entries.forEach(e => { delete e.days; }); }
  }
  function saveEntries() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch (e) {}
    pushCloudState();
  }

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
  function minToHHMM(mins) {
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }
  function duration(start, end) {
    const s = toMinutes(start), e = toMinutes(end);
    return e > s ? e - s : (DAY_MIN - s) + e;
  }
  function fmtHours(mins) {
    return (mins / 60).toFixed(1).replace(/\.0$/, '');
  }
  function fmtTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const period = h < 12 ? 'am' : 'pm';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')}${period}`;
  }
  function fmtWeekdays(days) {
    const sorted = [...days].sort((a, b) => a - b);
    if (sorted.length === 7) return 'Every day';
    if (sorted.join(',') === '0,1,2,3,4') return 'Mon–Fri';
    if (sorted.join(',') === '5,6') return 'Sat–Sun';
    let consecutive = true;
    for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) consecutive = false;
    if (consecutive && sorted.length > 1) return `${DAY_ABBR[sorted[0]]}–${DAY_ABBR[sorted[sorted.length - 1]]}`;
    return sorted.map(d => DAY_ABBR[d]).join(', ');
  }
  function fmtCycleDays(days) {
    const sorted = [...days].sort((a, b) => a - b);
    if (sorted.length === 10) return 'Every timetable day';
    const runs = [];
    let start = sorted[0], prev = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      if (i < sorted.length && sorted[i] === prev + 1) { prev = sorted[i]; continue; }
      runs.push(start === prev ? `${start}` : `${start}–${prev}`);
      if (i < sorted.length) { start = sorted[i]; prev = sorted[i]; }
    }
    return 'Day ' + runs.join(', ');
  }
  function fmtOnceDate(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtRecurrence(entry) {
    if (entry.recurrence === 'cycle') return fmtCycleDays(entry.cycleDays);
    if (entry.recurrence === 'once') return fmtOnceDate(entry.date);
    return fmtWeekdays(entry.weekdays);
  }
  function fmtPeriodInfo(info) {
    const dayLabel = window.TimeTurnerPeriods?.DAY_TYPES?.find(dt => dt.key === info.dayType)?.label
      || (info.dayType === 'friday' ? 'Friday' : 'Regular');
    const label = p => info.dayType === 'test' && p === 7 ? 'Test' : `P${p}`;
    const range = info.from === info.to ? label(info.from) : `${label(info.from)}–${label(info.to)}`;
    return `${range} (${dayLabel})`;
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** One-off (dated) entries aren't part of the repeating two-week
   * template at all — the grid has no anchor to real calendar dates
   * for weekly/cycle entries either, so there's no slot to place a
   * specific date into. They live in their own list instead, and
   * this keeps them out of the grid, totals, insights and suggestions,
   * all of which model a *typical* recurring week. */
  function slotsForEntry(entry) {
    if (entry.recurrence === 'cycle') return entry.cycleDays.map(cycleDayToSlot);
    if (entry.recurrence === 'once') return [];
    return entry.weekdays.flatMap(w => [w, w + 7]);
  }

  function addEntry(entry) {
    entries.push({ id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ...entry });
    saveEntries();
  }
  function deleteEntry(id) {
    entries = entries.filter(e => e.id !== id);
    saveEntries();
  }
  function clearAll() {
    entries = [];
    saveEntries();
  }

  /** Bulk-fills the plan from an uploaded timetable grid instead of 60
   * manual "Add a block" submissions — used for both a student's own
   * upload and a teacher's own teaching timetable, and for a student
   * importing their grade's shared timetable (see time-turner-timetable.js,
   * which owns parsing the upload and the grade_timetables table; this
   * only turns an already-parsed grid into entries).
   * grid: { "1": [p1Subject, ..., p6Subject], ... } keyed by cycle day
   * 1-10; a blank subject means a free period that day.
   * Re-running this replaces only entries from a previous import
   * (tagged _fromTimetable) — anything added by hand stays untouched. */
  function importScheduleFromGrid(grid) {
    entries = entries.filter(e => !e._fromTimetable);
    const periods = window.TimeTurnerPeriods?.getCached() || { regular: {}, friday: {} };
    let imported = 0, skipped = 0;
    Object.keys(grid || {}).forEach(dayStr => {
      const day = Number(dayStr);
      if (!day || day < 1 || day > 10) return;
      const dayType = day % 5 === 0 ? 'friday' : 'regular';
      (grid[dayStr] || []).forEach((subject, i) => {
        const period = i + 1;
        const title = (subject || '').trim();
        if (!title) return;
        const times = periods[dayType]?.[period];
        if (!times) { skipped++; return; }
        entries.push({
          id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          category: 'school', title, recurrence: 'cycle', cycleDays: [day],
          start: times.start, end: times.end,
          periodInfo: { dayType, from: period, to: period },
          _fromTimetable: true
        });
        imported++;
      });
    });
    saveEntries();
    renderAll();
    return { imported, skipped };
  }

  // ── Two-week grid ────────────────────────────────────────────
  function blocksForEntry(entry) {
    const s = toMinutes(entry.start), e = toMinutes(entry.end);
    const pieces = [];
    slotsForEntry(entry).forEach(slot => {
      if (e > s) {
        pieces.push({ slot, start: s, end: e, entry });
      } else {
        pieces.push({ slot, start: s, end: DAY_MIN, entry });
        pieces.push({ slot: (slot + 1) % SLOT_COUNT, start: 0, end: e, entry });
      }
    });
    return pieces;
  }

  function packLanes(pieces) {
    // Greedy interval-graph lane packing so overlapping blocks sit side by side.
    const sorted = [...pieces].sort((a, b) => a.start - b.start);
    const laneEnds = [];
    sorted.forEach(p => {
      let lane = laneEnds.findIndex(end => end <= p.start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(p.end); }
      else laneEnds[lane] = p.end;
      p.lane = lane;
    });
    const laneCount = laneEnds.length || 1;
    sorted.forEach(p => { p.laneCount = laneCount; });
    return sorted;
  }

  /** School bell times shift day to day in practice (assemblies, guardian
   * sessions, connect periods) — closer to "period 1-6" than to any one
   * fixed clock time. Rather than fight that, each school day's column
   * gets its own faint period/break bands (using that weekday's real
   * period_schedule day-type) layered under the blocks, so the period
   * number is visible right where it applies, in addition to the
   * always-on hour gutter that still covers the non-school parts of
   * the day (sleep, evening activities, weekends). */
  function renderPeriodBands(dayType) {
    const periods = window.TimeTurnerPeriods?.getCached()?.[dayType];
    if (!periods) return '';
    const nums = Object.keys(periods).map(Number).sort((a, b) => a - b);
    if (!nums.length) return '';
    let html = '';
    nums.forEach((p, i) => {
      const { start, end } = periods[p];
      html += `<div class="period-band-line" style="top:${toMinutes(start) * PX_PER_MIN}px;"><span class="period-band-label">P${p}</span></div>`;
      const next = periods[nums[i + 1]];
      if (next && toMinutes(next.start) > toMinutes(end)) {
        html += `<div class="period-band-line break" style="top:${toMinutes(end) * PX_PER_MIN}px;"><span class="period-band-label">Break</span></div>`;
      }
    });
    const lastEnd = periods[nums[nums.length - 1]].end;
    html += `<div class="period-band-line" style="top:${toMinutes(lastEnd) * PX_PER_MIN}px;"></div>`;
    return html;
  }

  function renderWeekGrid(elId, weekIndex, bySlot, ghostsBySlot) {
    const todayIdx = (new Date().getDay() + 6) % 7; // JS 0=Sun -> our 0=Mon

    const gutter = `<div class="grid-gutter">${
      Array.from({ length: 24 }, (_, h) =>
        `<div class="grid-gutter-label" style="top:${h * 60 * PX_PER_MIN}px;">${String(h).padStart(2, '0')}:00</div>`
      ).join('')
    }</div>`;

    const days = DAY_ABBR.map((name, weekday) => {
      const slot = weekIndex * 7 + weekday;
      const pieces = packLanes(bySlot[slot]);
      const cycleDay = slotCycleDay(slot);
      const dayType = weekday === 4 ? 'friday' : weekday < 5 ? 'regular' : null;
      const periodBands = dayType ? renderPeriodBands(dayType) : '';
      const blocks = pieces.map(p => {
        const cat = CATEGORIES[p.entry.category] || CATEGORIES.other;
        const top = p.start * PX_PER_MIN;
        const height = Math.max((p.end - p.start) * PX_PER_MIN, 10);
        const widthPct = 100 / p.laneCount;
        const leftPct = p.lane * widthPct;
        const label = p.entry.title || cat.label;
        const showText = height >= 16;
        return `<div class="grid-block" style="top:${top}px;height:${height}px;left:${leftPct}%;width:calc(${widthPct}% - 2px);background:${cat.color}33;border-left-color:${cat.color};" title="${esc(label)} (${fmtTime(p.entry.start)}–${fmtTime(p.entry.end)})">${showText ? `<div class="gb-title">${cat.emoji} ${esc(label)}</div>` : ''}</div>`;
      }).join('');
      const ghosts = (ghostsBySlot[slot] || []).map(s => {
        const cat = CATEGORIES[s.category] || CATEGORIES.other;
        const top = s.start * PX_PER_MIN;
        const height = Math.max((s.end - s.start) * PX_PER_MIN, 10);
        const showText = height >= 16;
        const tooltip = `${s.title} (${fmtTime(minToHHMM(s.start))}–${fmtTime(minToHHMM(s.end))})${s.reason ? ' — ' + s.reason : ''}`;
        return `<div class="grid-ghost" data-ghost="${esc(s.key)}" style="top:${top}px;height:${height}px;border-color:${cat.color};color:${cat.color};" title="${esc(tooltip)}">${showText ? `<span class="gg-title">${cat.emoji} ${esc(s.title)}</span>` : '<span></span>'}<span class="gg-dismiss" data-dismiss="${esc(s.key)}" title="Dismiss">×</span></div>`;
      }).join('');
      return `<div class="grid-day">
        <div class="grid-day-head${weekday === todayIdx ? ' today' : ''}">${name}${cycleDay ? `<div class="grid-day-cycle">Day ${cycleDay}</div>` : ''}</div>
        <div class="grid-day-col" style="height:${DAY_MIN * PX_PER_MIN}px;">${periodBands}${blocks}${ghosts}</div>
      </div>`;
    }).join('');

    document.getElementById(elId).innerHTML = `${gutter}<div class="grid-days">${days}</div>`;
  }

  function computeBySlot() {
    const bySlot = Array.from({ length: SLOT_COUNT }, () => []);
    entries.flatMap(blocksForEntry).forEach(p => bySlot[p.slot].push(p));
    return bySlot;
  }

  function addSuggestionAsEntry(s) {
    const cycleDay = slotCycleDay(s.slot);
    const entry = { category: s.category, title: s.title, start: minToHHMM(s.start), end: minToHHMM(s.end) };
    if (cycleDay) { entry.recurrence = 'cycle'; entry.cycleDays = [cycleDay]; }
    else { entry.recurrence = 'weekly'; entry.weekdays = [s.slot % 7]; }
    addEntry(entry);
  }

  function wireGhostHandlers(suggestions) {
    document.querySelectorAll('.grid-ghost').forEach(el => {
      el.addEventListener('click', () => {
        const s = suggestions.find(x => x.key === el.dataset.ghost);
        if (!s) return;
        addSuggestionAsEntry(s);
        renderAll();
      });
    });
    document.querySelectorAll('.gg-dismiss').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissedSuggestionKeys.add(btn.dataset.dismiss);
        saveDismissed();
        renderGrid();
      });
    });
  }

  function renderGrid() {
    const bySlot = computeBySlot();
    const suggestions = computeSuggestions();
    const ghostsBySlot = Array.from({ length: SLOT_COUNT }, () => []);
    suggestions.forEach(s => ghostsBySlot[s.slot].push(s));

    renderWeekGrid('week-grid-1', 0, bySlot, ghostsBySlot);
    renderWeekGrid('week-grid-2', 1, bySlot, ghostsBySlot);

    document.getElementById('legend').innerHTML = Object.entries(CATEGORIES).map(([key, c]) =>
      `<div class="legend-item"><span class="legend-swatch" style="background:${c.color};"></span>${c.emoji} ${esc(c.label)}</div>`
    ).join('');

    wireGhostHandlers(suggestions);
  }

  // ── Totals ───────────────────────────────────────────────────
  // Totals are counted across the full 2-week cycle, then halved for a
  // "per week" average — the natural unit whether an entry repeats every
  // week or only on specific timetable days.
  function totalsOverCycle() {
    const totals = {};
    Object.keys(CATEGORIES).forEach(c => { totals[c] = 0; });
    entries.forEach(e => { totals[e.category] += duration(e.start, e.end) * slotsForEntry(e).length; });
    return totals;
  }
  function weeklyAverages() {
    const cycle = totalsOverCycle();
    const weekly = {};
    Object.keys(cycle).forEach(k => { weekly[k] = cycle[k] / 2; });
    return weekly;
  }

  function renderTotals() {
    const box = document.getElementById('totals');
    if (!entries.length) { box.innerHTML = '<div class="empty-hint">Add a few blocks above to see your totals.</div>'; return; }

    const totals = weeklyAverages();
    const maxWeek = 7 * 24 * 60;
    box.innerHTML = Object.entries(CATEGORIES).map(([key, c]) => {
      const mins = totals[key];
      const pct = Math.min(100, (mins / maxWeek) * 100 * 6); // scaled so a realistic ~20h/wk category reads as a full-ish bar
      return `<div class="total-row">
        <div class="total-label">${c.emoji} ${esc(c.label)}</div>
        <div class="total-bar-track"><div class="total-bar-fill" style="width:${pct}%;background:${c.color};"></div></div>
        <div class="total-hours">${fmtHours(mins)} h</div>
      </div>`;
    }).join('');
  }

  // ── Insights (data-driven tips) ──────────────────────────────
  function computeInsights() {
    if (!entries.length) {
      return [{ level: 'info', icon: '👋', text: 'Start with your fixed commitments — school hours and sleep — everything else fits around those two.' }];
    }

    const totals = weeklyAverages();
    const insights = [];

    const sleepPerNight = totals.rest / 7 / 60;
    if (totals.rest === 0) {
      insights.push({ level: 'warn', icon: '😴', text: "No sleep/rest blocks scheduled yet — add your usual bedtime and wake time so the plan accounts for it. \"Fill your open time\" below can suggest a wind-down slot." });
    } else if (sleepPerNight < 7.5) {
      insights.push({ level: 'warn', icon: '😴', text: `Sleep averages about ${sleepPerNight.toFixed(1)} h/night in this plan. Teenagers need roughly 8–10 hours a night — try moving bedtime earlier.` });
    }

    const freeHours = totals.free / 60;
    if (freeHours < 3) {
      insights.push({ level: 'warn', icon: '🎮', text: 'Very little unstructured free time is scheduled. Downtime isn’t wasted time — it helps you concentrate better in the hours you do study.' });
    }

    const perSlotHomework = Array(SLOT_COUNT).fill(0);
    entries.filter(e => e.category === 'homework').forEach(e => {
      const mins = duration(e.start, e.end);
      slotsForEntry(e).forEach(slot => { perSlotHomework[slot] += mins; });
    });
    const heavySlot = perSlotHomework.findIndex(m => m > 180);
    if (heavySlot >= 0) {
      insights.push({ level: 'warn', icon: '📚', text: `${slotLabel(heavySlot)} has more than 3 hours of homework/study blocked. Split long sessions into 25–45 minute focused blocks with short breaks — it works better than one long sitting.` });
    }

    if (totals.chores === 0) {
      insights.push({ level: 'info', icon: '🧹', text: 'No time set aside for chores/cleaning up yet — even 15 minutes a day keeps it from piling up into a whole afternoon later. See "Fill your open time" below for a suggested slot.' });
    }
    if (totals.meals === 0) {
      insights.push({ level: 'info', icon: '🍽️', text: 'No meal times blocked yet — scheduling them (not just "whenever") makes it easier to protect study time around them. "Fill your open time" below can suggest lunch and dinner slots.' });
    }
    if (totals.family === 0) {
      insights.push({ level: 'info', icon: '❤️', text: 'No family time blocked yet — even a shared dinner or a fixed evening slot keeps it from getting crowded out by everything else. See "Fill your open time" below for a suggested slot.' });
    }

    if (!insights.length) {
      insights.push({ level: 'ok', icon: '✅', text: 'This looks like a balanced plan — school, study, activities, rest and free time all have a place.' });
    }
    return insights;
  }

  // One sentence up front — the thing most worth changing right now —
  // with anything else tucked behind a toggle instead of a full dashboard
  // of tips to read through every time.
  const INSIGHT_LEVEL_PRIORITY = { warn: 0, info: 1, ok: 2 };
  function renderInsights() {
    const insights = [...computeInsights()].sort((a, b) => (INSIGHT_LEVEL_PRIORITY[a.level] ?? 1) - (INSIGHT_LEVEL_PRIORITY[b.level] ?? 1));
    const [lead, ...rest] = insights;
    const box = document.getElementById('insights');

    const leadHtml = `<div class="insight-lead ${lead.level}"><span class="insight-lead-icon">${lead.icon}</span><span>${esc(lead.text)}</span></div>`;
    if (!rest.length) { box.innerHTML = leadHtml; return; }

    box.innerHTML = `${leadHtml}
      <button type="button" class="insight-more-toggle" id="insight-more-toggle">+${rest.length} more insight${rest.length === 1 ? '' : 's'}</button>
      <div class="insight-more hidden" id="insight-more">${rest.map(i =>
        `<div class="tip ${i.level}"><span class="tip-icon">${i.icon}</span><span>${esc(i.text)}</span></div>`
      ).join('')}</div>`;

    const toggle = document.getElementById('insight-more-toggle');
    toggle.addEventListener('click', () => {
      const nowHidden = document.getElementById('insight-more').classList.toggle('hidden');
      toggle.textContent = nowHidden ? `+${rest.length} more insight${rest.length === 1 ? '' : 's'}` : 'Show less';
    });
  }

  // ── Fill-your-open-time suggestions (rule-based, no AI) ───────
  // Looks at the gaps left in each slot after existing entries and the
  // school timetable, and proposes specific blocks — meals, a homework
  // session, a wind-down before bed, or just free time — for the
  // student to accept or dismiss. Every rule reads only from the data
  // already on this page (entries + categories); nothing is guessed
  // beyond what a reasonable default schedule would do.
  const SUGGEST_START = 6 * 60, SUGGEST_END = 21 * 60, MIN_GAP = 20;
  const DISMISSED_KEY = 'ml-time-turner-dismissed-v1';
  let dismissedSuggestionKeys = new Set();

  function loadDismissed() {
    try { dismissedSuggestionKeys = new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY)) || []); } catch (e) { dismissedSuggestionKeys = new Set(); }
  }
  function saveDismissed() {
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedSuggestionKeys])); } catch (e) {}
    pushCloudState();
  }

  // ── Cross-device sync ──────────────────────────────────────────
  // localStorage is instant and works offline, so it stays the local
  // cache and the thing every render reads from. Supabase is the
  // cross-device copy: on load, whatever's already in the cloud wins
  // (so switching devices doesn't strand your plan on the old one);
  // after that, every local change is pushed up. cloudReady guards
  // against a real race — without it, a brand-new browser with empty
  // localStorage could push that emptiness to the cloud before the
  // initial pull even finishes, clobbering a plan built on another
  // device before it ever got read back.
  const CLOUD_DEBOUNCE_MS = 1200;
  let cloudSyncTimer = null;
  let cloudReady = false;
  // feedToken addresses this student's row for the public live-.ics Edge
  // Function (see ics-feed) — it carries no other privilege, so it's
  // fine to hold in a plain module variable and hand out in a URL.
  let feedToken = null;

  function pushCloudState() {
    if (!cloudReady || !window.MagicLabAuth?._supabase) return;
    const profile = window.MagicLabAuth.getProfile?.();
    if (!profile?.id) return;
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
      let planName = '', anchorDate = '';
      try { planName = localStorage.getItem(NAME_KEY) || ''; } catch (e) {}
      try { anchorDate = localStorage.getItem(ANCHOR_KEY) || ''; } catch (e) {}
      window.MagicLabAuth._supabase().from('planner_entries')
        .upsert({
          student_id: profile.id,
          plan_name: planName,
          anchor_date: anchorDate || null,
          entries,
          dismissed_suggestions: [...dismissedSuggestionKeys],
          updated_at: new Date().toISOString()
        })
        .then(({ error }) => { if (error) console.warn('[MagicLab] planner cloud sync error:', error.message); });
    }, CLOUD_DEBOUNCE_MS);
  }

  async function pullCloudState() {
    // cloudReady must end up true no matter what happens below — a
    // thrown error here (bad network, a malformed response) must not
    // permanently wedge the app into "never sync" for the rest of the
    // page's life, since every future save gates on this flag.
    try {
      if (!window.MagicLabAuth?._supabase) return false;
      const profile = window.MagicLabAuth.getProfile?.();
      if (!profile?.id) return false;
      const { data, error } = await window.MagicLabAuth._supabase().from('planner_entries').select('*').eq('student_id', profile.id).maybeSingle();
      if (error || !data) return false;

      entries = Array.isArray(data.entries) ? data.entries : [];
      dismissedSuggestionKeys = new Set(Array.isArray(data.dismissed_suggestions) ? data.dismissed_suggestions : []);
      saveEntries();   // cloudReady is still false here, so this only writes the local cache
      saveDismissed(); // same
      if (data.plan_name != null) { try { localStorage.setItem(NAME_KEY, data.plan_name); } catch (e) {} }
      if (data.anchor_date) { try { localStorage.setItem(ANCHOR_KEY, data.anchor_date); } catch (e) {} }
      feedToken = data.feed_token || null;
      return true;
    } catch (e) {
      console.warn('[MagicLab] planner cloud pull error:', e.message);
      return false;
    } finally {
      cloudReady = true;
    }
  }

  // ── Live calendar subscription (ics-feed Edge Function) ────────────
  // A subscribed webcal:// URL updates itself as the plan changes,
  // unlike the static export below — the Edge Function has no session
  // to authenticate a calendar app's plain GET request with, so it
  // trusts this opaque per-student token instead. Generated on demand
  // (not at signup) since most students will only ever use the
  // one-off .ics download.
  const ICS_FEED_BASE = 'https://hrnodxqvyxzhfexkzeji.supabase.co/functions/v1/ics-feed';
  function feedUrlFor(token) { return `${ICS_FEED_BASE}/${token}.ics`; }

  async function ensureFeedToken() {
    if (feedToken) return feedToken;
    if (!window.MagicLabAuth?._supabase) return null;
    const profile = window.MagicLabAuth.getProfile?.();
    if (!profile?.id) return null;
    const token = crypto.randomUUID();
    const { error } = await window.MagicLabAuth._supabase().from('planner_entries')
      .upsert({ student_id: profile.id, feed_token: token, updated_at: new Date().toISOString() });
    if (error) { console.warn('[MagicLab] feed token error:', error.message); return null; }
    feedToken = token;
    return token;
  }

  async function regenerateFeedToken() {
    feedToken = null;
    return ensureFeedToken();
  }

  function renderSubscribe() {
    const box = document.getElementById('subscribe-card');
    if (!box) return;
    const signedIn = !!window.MagicLabAuth?.getProfile?.()?.id;
    document.getElementById('subscribe-signedout').classList.toggle('hidden', signedIn);
    document.getElementById('subscribe-getlink').classList.toggle('hidden', !signedIn || !!feedToken);
    document.getElementById('subscribe-linkbox').classList.toggle('hidden', !signedIn || !feedToken);
    if (feedToken) {
      const url = feedUrlFor(feedToken);
      document.getElementById('subscribe-webcal-link').href = url.replace(/^https?:\/\//, 'webcal://');
      document.getElementById('subscribe-url').value = url;
    }
  }

  function wireSubscribe() {
    const msg = document.getElementById('subscribe-msg');
    document.getElementById('subscribe-get-btn').addEventListener('click', async () => {
      msg.textContent = 'Setting up…'; msg.className = 'msg';
      const token = await ensureFeedToken();
      msg.textContent = token ? '' : 'Something went wrong — try again.';
      msg.className = token ? 'msg' : 'msg err';
      renderSubscribe();
    });
    document.getElementById('subscribe-copy-btn').addEventListener('click', async () => {
      const input = document.getElementById('subscribe-url');
      try {
        await navigator.clipboard.writeText(input.value);
        msg.textContent = 'Copied.'; msg.className = 'msg ok';
      } catch (e) {
        input.select();
        msg.textContent = 'Select the link above and copy it manually.'; msg.className = 'msg';
      }
    });
    document.getElementById('subscribe-regenerate-btn').addEventListener('click', async () => {
      if (!confirm('Old subscription links will stop working immediately. Continue?')) return;
      msg.textContent = 'Regenerating…'; msg.className = 'msg';
      const token = await regenerateFeedToken();
      msg.textContent = token ? 'New link ready.' : 'Something went wrong — try again.';
      msg.className = token ? 'msg ok' : 'msg err';
      renderSubscribe();
    });
  }

  function freeGapsForSlot(pieces) {
    const merged = [];
    [...pieces].sort((a, b) => a.start - b.start).forEach(p => {
      if (merged.length && p.start <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, p.end);
      } else {
        merged.push({ start: p.start, end: p.end });
      }
    });
    const gaps = [];
    let cursor = SUGGEST_START;
    merged.forEach(m => {
      if (m.start > cursor) gaps.push({ start: cursor, end: Math.min(m.start, SUGGEST_END) });
      cursor = Math.max(cursor, m.end);
    });
    if (cursor < SUGGEST_END) gaps.push({ start: cursor, end: SUGGEST_END });
    return gaps.filter(g => g.end - g.start >= MIN_GAP);
  }

  function hasCategoryNear(pieces, category, from, to) {
    return pieces.some(p => p.entry.category === category && p.start < to && p.end > from);
  }
  function categoryMinutes(pieces, category) {
    return pieces.filter(p => p.entry.category === category).reduce((sum, p) => sum + (p.end - p.start), 0);
  }
  function mkSuggestion(slot, category, title, start, end, reason) {
    return { slot, category, title, start, end, reason, key: `${slot}|${category}|${start}` };
  }

  /** Within one contiguous free gap, carve out suggestions in priority
   * order (lunch, dinner, homework, wind-down, then whatever's left),
   * shrinking the remaining free window as each is claimed — so a
   * single long afternoon-to-evening gap can yield dinner AND a study
   * block AND a wind-down, instead of just the first thing that fits. */
  function suggestionsForSlot(slot, pieces) {
    const hasSchool = pieces.some(p => p.entry.category === 'school');
    const out = [];

    freeGapsForSlot(pieces).forEach(gap => {
      let remaining = [{ start: gap.start, end: gap.end }];

      function take(from, to, category, title, reason) {
        for (let i = 0; i < remaining.length; i++) {
          const r = remaining[i];
          if (r.start <= from && r.end >= to) {
            out.push(mkSuggestion(slot, category, title, from, to, reason));
            const pieces2 = [];
            if (from - r.start > 0) pieces2.push({ start: r.start, end: from });
            if (r.end - to > 0) pieces2.push({ start: to, end: r.end });
            remaining.splice(i, 1, ...pieces2);
            return true;
          }
        }
        return false;
      }

      if (!hasCategoryNear(pieces, 'meals', 11 * 60, 15 * 60)) {
        const from = Math.max(gap.start, 12 * 60), to = Math.min(from + 45, 14 * 60);
        if (to - from >= MIN_GAP) take(from, to, 'meals', 'Lunch', 'No lunch logged around midday');
      }
      if (!hasCategoryNear(pieces, 'meals', 17 * 60 + 30, 20 * 60)) {
        const from = Math.max(gap.start, 18 * 60), to = Math.min(from + 45, 19 * 60 + 30);
        if (to - from >= MIN_GAP) take(from, to, 'meals', 'Dinner', 'No dinner logged in the evening');
      }
      if (hasSchool && categoryMinutes(pieces, 'homework') < 60) {
        let best = null;
        remaining.filter(r => r.end > 14 * 60).forEach(r => {
          const s = Math.max(r.start, 14 * 60), e = r.end;
          if (e - s >= 30 && (!best || (e - s) > (best.end - best.start))) best = { start: s, end: e };
        });
        if (best) take(best.start, Math.min(best.start + 60, best.end), 'homework', 'Study block', 'Less than 1h of study blocked today');
      }
      if (!hasCategoryNear(pieces, 'rest', 19 * 60, SUGGEST_END)) {
        const tail = remaining.find(r => r.end >= SUGGEST_END - 15 && r.start >= 19 * 60 - 30);
        if (tail) {
          const s = Math.max(tail.start, 20 * 60), e = tail.end;
          if (e - s >= MIN_GAP) take(s, e, 'rest', 'Wind down', 'No rest/wind-down block yet this evening');
        }
      }
      remaining.forEach(r => {
        if (r.end - r.start >= 90) out.push(mkSuggestion(slot, 'free', 'Free time', r.start, Math.min(r.start + 60, r.end), 'Open time with nothing planned'));
      });
    });

    return out.slice(0, 4);
  }

  /** Habits that matter over a whole week (chores, family time, exercise)
   * shouldn't get suggested on every single day — that's noise, not help.
   * Each gets at most one suggestion across the whole two-week view,
   * placed on the first day with room for it, and only while the habit
   * has essentially no time logged anywhere in the plan yet. */
  function addWeeklyHabitOnce(all, bySlot, category, title, minDuration, reason, preferAfternoon) {
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const pieces = bySlot[slot];
      if (categoryMinutes(pieces, category) > 0) continue;
      const claimed = all.filter(s => s.slot === slot);
      const candidates = [];
      freeGapsForSlot(pieces).forEach(gap => {
        let segs = [{ start: gap.start, end: gap.end }];
        claimed.forEach(c => {
          segs = segs.flatMap(sg => {
            if (c.start >= sg.end || c.end <= sg.start) return [sg];
            const pieces2 = [];
            if (c.start > sg.start) pieces2.push({ start: sg.start, end: c.start });
            if (c.end < sg.end) pieces2.push({ start: c.end, end: sg.end });
            return pieces2;
          });
        });
        segs.filter(sg => sg.end - sg.start >= minDuration).forEach(sg => candidates.push(sg));
      });
      if (!candidates.length) continue;
      const afternoon = candidates.find(sg => sg.start >= 14 * 60);
      const seg = (preferAfternoon && afternoon) ? afternoon : candidates[0];
      const s = mkSuggestion(slot, category, title, seg.start, seg.start + minDuration, reason);
      if (!dismissedSuggestionKeys.has(s.key)) all.push(s);
      return;
    }
  }

  function computeSuggestions() {
    const bySlot = computeBySlot();
    const all = [];
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      suggestionsForSlot(slot, bySlot[slot]).forEach(s => { if (!dismissedSuggestionKeys.has(s.key)) all.push(s); });
    }

    const totals = weeklyAverages();
    if (totals.chores === 0) addWeeklyHabitOnce(all, bySlot, 'chores', 'Chores', 15, 'No chores time logged this week', true);
    if (totals.family === 0) addWeeklyHabitOnce(all, bySlot, 'family', 'Family time', 30, 'No family time logged this week', true);
    if (totals.extracurricular / 60 < 3) addWeeklyHabitOnce(all, bySlot, 'extracurricular', 'Exercise / activity', 45, 'Less than 3h of exercise logged this week', false);

    return all;
  }

  const GENERAL_TIPS = [
    { icon: '🎯', text: 'Do your hardest or most disliked subject first, while your energy and focus are highest.' },
    { icon: '⏲️', text: 'Study in focused blocks of 25–45 minutes with a 5–10 minute break between them — it beats one long unbroken session.' },
    { icon: '🔁', text: "Go back over the day's classwork that same afternoon, even for 10 minutes — it cuts revision time before tests dramatically." },
    { icon: '🌙', text: 'Keep bedtime and wake time consistent, even on weekends — it matters more than a few extra hours some nights.' },
    { icon: '🎒', text: "Pack your bag and lay out tomorrow's things the night before — it removes decisions from your morning." }
  ];

  function renderGeneralTips() {
    document.getElementById('general-tips').innerHTML = GENERAL_TIPS.map(t =>
      `<div class="tip"><span class="tip-icon">${t.icon}</span><span>${esc(t.text)}</span></div>`
    ).join('');
  }

  // ── Entries list ─────────────────────────────────────────────
  function renderEntriesList() {
    const box = document.getElementById('entries-list');
    const recurring = entries.filter(e => e.recurrence !== 'once');
    if (!recurring.length) { box.innerHTML = '<div class="empty-hint">Nothing added yet.</div>'; return; }

    const sorted = [...recurring].sort((a, b) => a.category.localeCompare(b.category) || toMinutes(a.start) - toMinutes(b.start));
    box.innerHTML = sorted.map(e => {
      const cat = CATEGORIES[e.category] || CATEGORIES.other;
      const recurTag = e.recurrence === 'cycle' ? ' · timetable' : '';
      const timeLabel = e.periodInfo ? fmtPeriodInfo(e.periodInfo) : `${fmtTime(e.start)}–${fmtTime(e.end)}`;
      return `<div class="entry-row" data-id="${e.id}">
        <div class="entry-emoji">${cat.emoji}</div>
        <div class="entry-body">
          <div class="entry-title">${esc(e.title || cat.label)}${e.reminder ? ' 🔔' : ''}</div>
          <div class="entry-meta">${esc(fmtRecurrence(e))}${recurTag} · ${esc(timeLabel)}</div>
        </div>
        <button class="entry-del" data-del="${e.id}" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
      </div>`;
    }).join('');

    box.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => { deleteEntry(btn.dataset.del); renderAll(); });
    });
    window.lucide?.createIcons();
  }

  function renderOnceOffList() {
    const box = document.getElementById('onceoff-list');
    if (!box) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const onceOff = entries.filter(e => e.recurrence === 'once')
      .sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.start) - toMinutes(b.start));
    if (!onceOff.length) { box.innerHTML = '<div class="empty-hint">Nothing added yet.</div>'; return; }

    box.innerHTML = onceOff.map(e => {
      const cat = CATEGORIES[e.category] || CATEGORIES.other;
      const isPast = new Date(e.date + 'T00:00:00') < today;
      return `<div class="entry-row" data-id="${e.id}" style="${isPast ? 'opacity:0.5;' : ''}">
        <div class="entry-emoji">${cat.emoji}</div>
        <div class="entry-body">
          <div class="entry-title">${esc(e.title || cat.label)}${e.reminder ? ' 🔔' : ''}</div>
          <div class="entry-meta">${esc(fmtOnceDate(e.date))} · ${esc(fmtTime(e.start))}–${esc(fmtTime(e.end))}${isPast ? ' · past' : ''}</div>
        </div>
        <button class="entry-del" data-del="${e.id}" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
      </div>`;
    }).join('');

    box.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => { deleteEntry(btn.dataset.del); renderAll(); });
    });
    window.lucide?.createIcons();
  }

  // ── Print header ─────────────────────────────────────────────
  function renderPrintHeader() {
    const name = document.getElementById('plan-name').value.trim();
    document.getElementById('print-name').textContent = name ? `for ${name}` : '';
    document.getElementById('print-date').textContent = 'Prepared ' + new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function renderAll() {
    renderGrid();
    renderTotals();
    renderInsights();
    renderGeneralTips();
    renderEntriesList();
    renderOnceOffList();
    renderPrintHeader();
    renderQuickstart();
    renderSubscribe();
    syncPlannerSummary();
    window.lucide?.createIcons();
  }

  // ── Quick start ──────────────────────────────────────────────
  // The blank grid is the biggest drop-off point for a first-time user —
  // offer sensible defaults for the two things almost everyone has
  // (sleep, meals) instead of an empty form. Shown only while the plan
  // is empty, or until explicitly skipped.
  const QUICKSTART_SKIP_KEY = 'ml-time-turner-quickstart-skip';
  const QUICKSTART_DEFAULTS = [
    { category: 'rest', title: 'Sleep', recurrence: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6], start: '22:00', end: '06:30' },
    { category: 'meals', title: 'Breakfast', recurrence: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6], start: '06:30', end: '07:00' },
    { category: 'meals', title: 'Lunch', recurrence: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6], start: '12:30', end: '13:00' },
    { category: 'meals', title: 'Dinner', recurrence: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6], start: '18:30', end: '19:15' }
  ];
  function renderQuickstart() {
    const wrap = document.getElementById('quickstart-wrap');
    if (!wrap) return;
    let skipped = false;
    try { skipped = localStorage.getItem(QUICKSTART_SKIP_KEY) === '1'; } catch (e) {}
    wrap.classList.toggle('hidden', entries.length > 0 || skipped);
  }
  function wireQuickstart() {
    document.getElementById('quickstart-btn').addEventListener('click', () => {
      QUICKSTART_DEFAULTS.forEach(addEntry);
      renderAll();
    });
    document.getElementById('quickstart-skip').addEventListener('click', () => {
      try { localStorage.setItem(QUICKSTART_SKIP_KEY, '1'); } catch (e) {}
      renderQuickstart();
    });
  }

  // ── Wellbeing summary sync ─────────────────────────────────────
  // The planner itself stays entirely local — this pushes only the
  // weekly category TOTALS (same numbers already shown in "Weekly
  // totals" above) up to Supabase, never the underlying schedule, so a
  // teacher who already has this student in one of their classes can
  // see "low rest, no free time" without seeing the actual day-by-day
  // plan. No entries yet means no row at all — absence of data, not a
  // flag saying something's wrong.
  let plannerSyncTimer = null;
  function syncPlannerSummary() {
    if (!cloudReady || !entries.length || !window.MagicLabAuth?._supabase) return;
    clearTimeout(plannerSyncTimer);
    plannerSyncTimer = setTimeout(() => {
      try {
        const profile = window.MagicLabAuth.getProfile?.();
        if (!profile?.id) return;
        window.MagicLabAuth._supabase().from('planner_summaries')
          .upsert({ student_id: profile.id, weekly_minutes: weeklyAverages(), updated_at: new Date().toISOString() })
          .then(({ error }) => { if (error) console.warn('[MagicLab] planner sync error:', error.message); });
      } catch (e) {}
    }, 1500);
  }

  // ── Calendar export (.ics) ────────────────────────────────────
  // Weekly entries export as real recurring events — no setup needed,
  // since "every Monday" doesn't depend on any external date. Cycle
  // (timetable-day) entries have no anchor to a real calendar date
  // anywhere in this app, so they need the student to supply the real
  // date of Day 1; without it they're skipped rather than guessed.
  const ICS_BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  function icsPad2(n) { return String(n).padStart(2, '0'); }
  function icsDateTime(y, mo, d, hh, mm) { return `${y}${icsPad2(mo)}${icsPad2(d)}T${icsPad2(hh)}${icsPad2(mm)}00`; }
  function icsEscape(s) { return String(s || '').replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n'); }
  function icsAddDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  /** "Remind me the evening before at 19:00" regardless of what time the
   * event itself starts — expressed as a duration before DTSTART so it
   * still lands correctly on every occurrence of a recurring event. */
  function icsAlarmTrigger(startMinutes) {
    const minutesBefore = startMinutes + (24 * 60 - 19 * 60);
    const h = Math.floor(minutesBefore / 60), m = minutesBefore % 60;
    if (h > 0 && m > 0) return `-PT${h}H${m}M`;
    if (h > 0) return `-PT${h}H`;
    return `-PT${m}M`;
  }
  function icsNextDateForWeekday(weekday) {
    // weekday: 0=Mon..6=Sun (this app's convention) -> JS getDay(): 0=Sun..6=Sat
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const jsTarget = (weekday + 1) % 7;
    const diff = (jsTarget - today.getDay() + 7) % 7;
    return icsAddDays(today, diff);
  }

  function buildICS(anchorDateStr) {
    let anchor = null;
    if (anchorDateStr) {
      const [y, mo, d] = anchorDateStr.split('-').map(Number);
      anchor = new Date(y, mo - 1, d);
    }
    let skippedCycle = 0;
    const stampNow = new Date();
    const stamp = `${stampNow.getUTCFullYear()}${icsPad2(stampNow.getUTCMonth() + 1)}${icsPad2(stampNow.getUTCDate())}T${icsPad2(stampNow.getUTCHours())}${icsPad2(stampNow.getUTCMinutes())}${icsPad2(stampNow.getUTCSeconds())}Z`;

    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Magic Lab//Time Turner//EN', 'CALSCALE:GREGORIAN'];

    function pushEvent(uid, startDate, endDate, sh, sm, eh, em, title, catLabel, rrule, reminder) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}@themagiclab.co.za`);
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART:${icsDateTime(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate(), sh, sm)}`);
      lines.push(`DTEND:${icsDateTime(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate(), eh, em)}`);
      if (rrule) lines.push(`RRULE:${rrule}`);
      lines.push(`SUMMARY:${icsEscape(title)}`);
      lines.push(`CATEGORIES:${icsEscape(catLabel)}`);
      if (reminder) {
        lines.push('BEGIN:VALARM');
        lines.push('ACTION:DISPLAY');
        lines.push(`DESCRIPTION:${icsEscape(title)}`);
        lines.push(`TRIGGER:${icsAlarmTrigger(sh * 60 + sm)}`);
        lines.push('END:VALARM');
      }
      lines.push('END:VEVENT');
    }

    entries.forEach(entry => {
      const cat = CATEGORIES[entry.category] || CATEGORIES.other;
      const title = entry.title || cat.label;
      const [sh, sm] = entry.start.split(':').map(Number);
      const [eh, em] = entry.end.split(':').map(Number);
      const crosses = toMinutes(entry.end) <= toMinutes(entry.start);

      if (entry.recurrence === 'weekly') {
        const days = [...entry.weekdays].sort((a, b) => a - b);
        if (!days.length) return;
        const first = days.map(icsNextDateForWeekday).reduce((a, b) => (a < b ? a : b));
        const endDate = crosses ? icsAddDays(first, 1) : first;
        pushEvent(`tt-${entry.id}`, first, endDate, sh, sm, eh, em, title, cat.label, `FREQ=WEEKLY;BYDAY=${days.map(d => ICS_BYDAY[d]).join(',')}`, entry.reminder);
      } else if (entry.recurrence === 'cycle') {
        if (!anchor) { skippedCycle++; return; }
        entry.cycleDays.forEach(day => {
          const week = day <= 5 ? 0 : 1;
          const weekday = (day - 1) % 5;
          const date = icsAddDays(anchor, week * 7 + weekday);
          const endDate = crosses ? icsAddDays(date, 1) : date;
          pushEvent(`tt-${entry.id}-d${day}`, date, endDate, sh, sm, eh, em, title, cat.label, null, entry.reminder);
        });
      } else if (entry.recurrence === 'once') {
        const [y, mo, d] = entry.date.split('-').map(Number);
        const date = new Date(y, mo - 1, d);
        const endDate = crosses ? icsAddDays(date, 1) : date;
        pushEvent(`tt-${entry.id}`, date, endDate, sh, sm, eh, em, title, cat.label, null, entry.reminder);
      }
    });

    lines.push('END:VCALENDAR');
    return { ics: lines.join('\r\n'), skippedCycle };
  }

  function exportICS() {
    const msg = document.getElementById('ics-msg');
    const anchorDateStr = document.getElementById('ics-anchor-date').value || null;
    if (!entries.length) { msg.textContent = 'Add a few blocks first.'; msg.className = 'msg err'; return; }

    const { ics, skippedCycle } = buildICS(anchorDateStr);
    if (skippedCycle > 0) {
      msg.textContent = `Exported without ${skippedCycle} timetable-day block${skippedCycle === 1 ? '' : 's'} — enter the real date for Day 1 below to include ${skippedCycle === 1 ? 'it' : 'them'}.`;
      msg.className = 'msg';
      document.getElementById('ics-advanced-box').classList.remove('hidden');
      document.getElementById('ics-advanced-toggle').textContent = 'Hide advanced options';
    } else {
      msg.textContent = 'Exported.';
      msg.className = 'msg ok';
    }

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'time-turner-plan.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Add-entry form ───────────────────────────────────────────
  function renderWeekdayPicker() {
    const box = document.getElementById('af-weekdays');
    box.innerHTML = DAY_ABBR.map((name, d) => `<button type="button" class="day-btn" data-weekday="${d}">${name}</button>`).join('');
    box.querySelectorAll('.day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = Number(btn.dataset.weekday);
        if (selectedWeekdays.has(d)) selectedWeekdays.delete(d); else selectedWeekdays.add(d);
        btn.classList.toggle('active');
      });
    });
  }

  function renderCycleDayPicker() {
    const box = document.getElementById('af-cycledays');
    const rows = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]];
    box.innerHTML = rows.map((row, week) => `
      <div class="cycle-week-row">
        <span class="cycle-week-tag">Wk ${week + 1}</span>
        ${row.map(d => `<button type="button" class="day-btn cycle-day-btn" data-cycleday="${d}">${d}<small>${DAY_ABBR[(d - 1) % 5]}</small></button>`).join('')}
      </div>`).join('');
    box.querySelectorAll('.day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = Number(btn.dataset.cycleday);
        if (selectedCycleDays.has(d)) selectedCycleDays.delete(d); else selectedCycleDays.add(d);
        btn.classList.toggle('active');
      });
    });
  }

  function setRecurrenceMode(mode) {
    recurrence = mode;
    document.querySelectorAll('.recur-btn').forEach(b => b.classList.toggle('active', b.dataset.recur === mode));
    document.getElementById('weekday-picker').classList.toggle('hidden', mode !== 'weekly');
    document.getElementById('cycleday-picker').classList.toggle('hidden', mode !== 'cycle');
    document.getElementById('once-date-picker').classList.toggle('hidden', mode !== 'once');
  }

  let timeMode = 'clock';
  function setTimeMode(mode) {
    timeMode = mode;
    document.querySelectorAll('.timemode-btn').forEach(b => b.classList.toggle('active', b.dataset.timemode === mode));
    document.getElementById('clock-time-picker').classList.toggle('hidden', mode !== 'clock');
    document.getElementById('period-time-picker').classList.toggle('hidden', mode !== 'period');
  }
  function populatePeriodSelects() {
    const dayType = document.getElementById('af-daytype').value;
    const count = window.TimeTurnerPeriods?.periodCountFor?.(dayType) || 6;
    const options = Array.from({ length: count }, (_, i) => i + 1)
      .map(p => `<option value="${p}">${dayType === 'test' && p === 7 ? 'Test period' : `Period ${p}`}</option>`).join('');
    document.getElementById('af-period-from').innerHTML = options;
    document.getElementById('af-period-to').innerHTML = options;
  }

  // One primary action at rest: the add-block form stays collapsed
  // behind a single button until the student actually wants to add
  // something, then folds back up once they've submitted.
  function collapseAddBlockForm() {
    document.getElementById('add-block-form').classList.add('hidden');
    document.getElementById('add-block-toggle').innerHTML = '<i data-lucide="plus" style="width:14px;height:14px;"></i>Add a block';
    window.lucide?.createIcons();
  }
  function wireAddBlockToggle() {
    const toggle = document.getElementById('add-block-toggle');
    const form = document.getElementById('add-block-form');
    toggle.addEventListener('click', () => {
      const nowHidden = form.classList.toggle('hidden');
      toggle.innerHTML = nowHidden
        ? '<i data-lucide="plus" style="width:14px;height:14px;"></i>Add a block'
        : '<i data-lucide="minus" style="width:14px;height:14px;"></i>Close';
      window.lucide?.createIcons();
    });
  }

  function wireForm() {
    wireAddBlockToggle();
    const catSelect = document.getElementById('af-category');
    catSelect.innerHTML = Object.entries(CATEGORIES).map(([key, c]) => `<option value="${key}">${c.emoji} ${esc(c.label)}</option>`).join('');

    renderWeekdayPicker();
    renderCycleDayPicker();
    setRecurrenceMode('weekly');
    populatePeriodSelects();
    setTimeMode('clock');

    document.querySelectorAll('.recur-btn').forEach(btn => {
      btn.addEventListener('click', () => setRecurrenceMode(btn.dataset.recur));
    });

    document.querySelectorAll('.timemode-btn').forEach(btn => {
      btn.addEventListener('click', () => setTimeMode(btn.dataset.timemode));
    });

    document.getElementById('af-daytype').addEventListener('change', populatePeriodSelects);

    document.querySelectorAll('#weekday-picker .day-quick [data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        if (preset === 'weekdays') selectedWeekdays = new Set([0, 1, 2, 3, 4]);
        else if (preset === 'weekend') selectedWeekdays = new Set([5, 6]);
        else if (preset === 'everyday') selectedWeekdays = new Set([0, 1, 2, 3, 4, 5, 6]);
        else selectedWeekdays = new Set();
        document.querySelectorAll('#af-weekdays .day-btn').forEach(b => b.classList.toggle('active', selectedWeekdays.has(Number(b.dataset.weekday))));
      });
    });

    document.querySelectorAll('#cycleday-picker .day-quick [data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        if (preset === 'all10') selectedCycleDays = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        else if (preset === 'mon-thu') selectedCycleDays = new Set([1, 2, 3, 4, 6, 7, 8, 9]);
        else if (preset === 'fri') selectedCycleDays = new Set([5, 10]);
        else if (preset === 'week1') selectedCycleDays = new Set([1, 2, 3, 4, 5]);
        else if (preset === 'week2') selectedCycleDays = new Set([6, 7, 8, 9, 10]);
        else selectedCycleDays = new Set();
        document.querySelectorAll('#af-cycledays .day-btn').forEach(b => b.classList.toggle('active', selectedCycleDays.has(Number(b.dataset.cycleday))));
      });
    });

    document.getElementById('af-submit').addEventListener('click', () => {
      const msg = document.getElementById('af-msg');
      const category = catSelect.value;
      const title = document.getElementById('af-title').value.trim();

      let onceDate = null;
      if (recurrence === 'once') {
        onceDate = document.getElementById('af-once-date').value;
        if (!onceDate) { msg.textContent = 'Pick a date.'; msg.className = 'msg err'; return; }
      } else {
        const daySet = recurrence === 'cycle' ? selectedCycleDays : selectedWeekdays;
        if (!daySet.size) { msg.textContent = recurrence === 'cycle' ? 'Pick at least one timetable day.' : 'Pick at least one day.'; msg.className = 'msg err'; return; }
      }

      let start, end, periodInfo = null;
      if (timeMode === 'period') {
        const dayType = document.getElementById('af-daytype').value;
        const from = Number(document.getElementById('af-period-from').value);
        const to = Number(document.getElementById('af-period-to').value);
        if (to < from) { msg.textContent = '"To period" can’t be before "From period".'; msg.className = 'msg err'; return; }
        const daySchedule = window.TimeTurnerPeriods?.getCached()?.[dayType] || {};
        if (!daySchedule[from] || !daySchedule[to]) { msg.textContent = 'Those period times haven’t been set up yet — ask your teacher, or switch to clock time.'; msg.className = 'msg err'; return; }
        start = daySchedule[from].start;
        end = daySchedule[to].end;
        periodInfo = { dayType, from, to };
      } else {
        start = document.getElementById('af-start').value;
        end = document.getElementById('af-end').value;
        if (!start || !end) { msg.textContent = 'Set a start and end time.'; msg.className = 'msg err'; return; }
        if (start === end) { msg.textContent = 'Start and end time can’t be the same.'; msg.className = 'msg err'; return; }
      }

      const entry = { category, title: title || null, recurrence, start, end };
      if (periodInfo) entry.periodInfo = periodInfo;
      if (recurrence === 'cycle') entry.cycleDays = [...selectedCycleDays];
      else if (recurrence === 'once') entry.date = onceDate;
      else entry.weekdays = [...selectedWeekdays];
      if (document.getElementById('af-reminder').checked) entry.reminder = true;

      addEntry(entry);
      msg.textContent = '';
      document.getElementById('af-title').value = '';
      document.getElementById('af-reminder').checked = false;
      collapseAddBlockForm();
      renderAll();
    });

    const nameInput = document.getElementById('plan-name');
    try { nameInput.value = localStorage.getItem(NAME_KEY) || ''; } catch (e) {}
    nameInput.addEventListener('input', () => {
      try { localStorage.setItem(NAME_KEY, nameInput.value); } catch (e) {}
      renderPrintHeader();
      pushCloudState();
    });

    document.getElementById('ics-export-btn').addEventListener('click', exportICS);
    document.getElementById('ics-advanced-toggle').addEventListener('click', () => {
      const toggle = document.getElementById('ics-advanced-toggle');
      const nowHidden = document.getElementById('ics-advanced-box').classList.toggle('hidden');
      toggle.textContent = nowHidden ? 'Advanced: set Day 1 date' : 'Hide advanced options';
    });

    const anchorInput = document.getElementById('ics-anchor-date');
    try { anchorInput.value = localStorage.getItem(ANCHOR_KEY) || ''; } catch (e) {}
    anchorInput.addEventListener('input', () => {
      try { localStorage.setItem(ANCHOR_KEY, anchorInput.value); } catch (e) {}
      pushCloudState();
    });

    document.getElementById('print-btn').addEventListener('click', () => window.print());
    document.getElementById('clear-btn').addEventListener('click', () => {
      if (!entries.length) return;
      if (confirm('Remove everything you’ve added? This can’t be undone.')) { clearAll(); renderAll(); }
    });
  }

  async function init() {
    loadEntries();
    loadDismissed();
    wireForm();
    wireQuickstart();
    wireSubscribe();
    renderAll();
    const gotCloud = await pullCloudState();
    if (gotCloud) {
      try { document.getElementById('ics-anchor-date').value = localStorage.getItem(ANCHOR_KEY) || ''; } catch (e) {}
      renderAll();
    } else {
      pushCloudState();
    }
  }

  window.TimeTurner = { init, importScheduleFromGrid };
})();
