// THE MAGIC LAB — ics-feed Edge Function
// Serves a live, auto-updating .ics calendar for one student, addressed
// by an opaque per-student token (see planner_entries.feed_token) rather
// than a Supabase session — calendar apps subscribing to a webcal:// URL
// can only ever do a plain GET with no Authorization header, so this
// function has verify_jwt disabled and authenticates the request itself
// by matching that token, using the service role key to read the row
// (RLS on planner_entries stays student_id = auth.uid() only; this is
// the one deliberate, narrow bypass of it).
//
// The .ics logic here mirrors buildICS() in time-turner.js, with one
// difference: timetable-day ("cycle") entries are expressed as a real
// RRULE (FREQ=WEEKLY;INTERVAL=2) anchored to anchor_date, instead of a
// batch of one-off dated events — a live feed should keep producing
// future occurrences on its own, not just whatever existed at export
// time. The 10-day cycle always spans exactly two calendar weeks, so
// "every 2 weeks on this weekday" is an exact match for "this timetable
// day", not an approximation.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ICS_BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const CATEGORY_LABELS: Record<string, string> = {
  school: 'School / Academics',
  homework: 'Homework / Study',
  extracurricular: 'Extracurricular / Exercise',
  family: 'Family time',
  meals: 'Meals',
  chores: 'Chores / Cleaning up',
  rest: 'Rest / Sleep',
  free: 'Free time / Recreation',
  other: 'Other',
};

function icsPad2(n: number) { return String(n).padStart(2, '0'); }
function toMinutes(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function icsDateTime(y: number, mo: number, d: number, hh: number, mm: number) {
  return `${y}${icsPad2(mo)}${icsPad2(d)}T${icsPad2(hh)}${icsPad2(mm)}00`;
}
function icsEscape(s: string) { return String(s || '').replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n'); }
function icsAddDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function icsAlarmTrigger(startMinutes: number) {
  const minutesBefore = startMinutes + (24 * 60 - 19 * 60);
  const h = Math.floor(minutesBefore / 60), m = minutesBefore % 60;
  if (h > 0 && m > 0) return `-PT${h}H${m}M`;
  if (h > 0) return `-PT${h}H`;
  return `-PT${m}M`;
}
function icsNextDateForWeekday(weekday: number) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const jsTarget = (weekday + 1) % 7;
  const diff = (jsTarget - today.getDay() + 7) % 7;
  return icsAddDays(today, diff);
}

function buildICS(entries: any[], anchorDateStr: string | null): string {
  let anchor: Date | null = null;
  if (anchorDateStr) {
    const [y, mo, d] = anchorDateStr.split('-').map(Number);
    anchor = new Date(y, mo - 1, d);
  }
  const stampNow = new Date();
  const stamp = `${stampNow.getUTCFullYear()}${icsPad2(stampNow.getUTCMonth() + 1)}${icsPad2(stampNow.getUTCDate())}T${icsPad2(stampNow.getUTCHours())}${icsPad2(stampNow.getUTCMinutes())}${icsPad2(stampNow.getUTCSeconds())}Z`;

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Magic Lab//Time Turner//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:Time Turner plan', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
  ];

  function pushEvent(uid: string, startDate: Date, endDate: Date, sh: number, sm: number, eh: number, em: number, title: string, catLabel: string, rrule: string | null, reminder: boolean) {
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

  (entries || []).forEach((entry: any) => {
    if (!entry || !entry.start || !entry.end || !entry.recurrence) return;
    const catLabel = CATEGORY_LABELS[entry.category] || 'Other';
    const title = entry.title || catLabel;
    const [sh, sm] = entry.start.split(':').map(Number);
    const [eh, em] = entry.end.split(':').map(Number);
    const crosses = toMinutes(entry.end) <= toMinutes(entry.start);

    if (entry.recurrence === 'weekly') {
      const days = [...(entry.weekdays || [])].sort((a: number, b: number) => a - b);
      if (!days.length) return;
      const first = days.map(icsNextDateForWeekday).reduce((a: Date, b: Date) => (a < b ? a : b));
      const endDate = crosses ? icsAddDays(first, 1) : first;
      pushEvent(`tt-${entry.id}`, first, endDate, sh, sm, eh, em, title, catLabel, `FREQ=WEEKLY;BYDAY=${days.map((d: number) => ICS_BYDAY[d]).join(',')}`, !!entry.reminder);
    } else if (entry.recurrence === 'cycle') {
      if (!anchor) return; // no real Day 1 date on file yet — nothing to anchor these to
      (entry.cycleDays || []).forEach((day: number) => {
        const week = day <= 5 ? 0 : 1;
        const weekday = (day - 1) % 5;
        const date = icsAddDays(anchor as Date, week * 7 + weekday);
        const endDate = crosses ? icsAddDays(date, 1) : date;
        pushEvent(`tt-${entry.id}-d${day}`, date, endDate, sh, sm, eh, em, title, catLabel, `FREQ=WEEKLY;INTERVAL=2;BYDAY=${ICS_BYDAY[weekday]}`, !!entry.reminder);
      });
    } else if (entry.recurrence === 'once') {
      const [y, mo, d] = entry.date.split('-').map(Number);
      const date = new Date(y, mo - 1, d);
      const endDate = crosses ? icsAddDays(date, 1) : date;
      pushEvent(`tt-${entry.id}`, date, endDate, sh, sm, eh, em, title, catLabel, null, !!entry.reminder);
    }
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const rawToken = url.searchParams.get('token') || pathParts[pathParts.length - 1] || '';
  const token = rawToken.replace(/\.ics$/i, '');

  if (!token) {
    return new Response('Missing subscription token.', { status: 400, headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase
    .from('planner_entries')
    .select('entries, anchor_date')
    .eq('feed_token', token)
    .maybeSingle();

  if (error || !data) {
    return new Response('Unknown or revoked subscription link.', { status: 404, headers: CORS_HEADERS });
  }

  const ics = buildICS(Array.isArray(data.entries) ? data.entries : [], data.anchor_date || null);

  return new Response(ics, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  });
});
