import type { Session } from "./storage";

// All numbers here are derived directly from logged sessions.
// No hardcoded/sample values — if there's no data, callers should
// render an empty state rather than fabricate numbers.

export interface FocusLabStats {
  totalHours: number;
  totalSessions: number;
  avgDifficulty: number;
  avgFocus: number;
  avgRetention: number;
  avgSessionMin: number;
  weeklyGoalHours: number;
  weeklyGoalPct: number; // 0-100+, hours studied in last 7 days vs goal
  weekSessionCount: number;
  dayOfWeekHours: { day: string; hours: number }[]; // Mon..Sun, last 7 days
  subjectBreakdown: { subject: string; hours: number; pctOfTotal: number }[];
  strength: string | null;
  opportunity: string | null;
  tip: string | null;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKLY_GOAL_KEY = "study_coach_weekly_goal_hours";
const DEFAULT_WEEKLY_GOAL = 40;

export function getWeeklyGoalHours(): number {
  const raw = localStorage.getItem(WEEKLY_GOAL_KEY);
  const n = raw ? Number(raw) : DEFAULT_WEEKLY_GOAL;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_WEEKLY_GOAL;
}

export function setWeeklyGoalHours(hours: number) {
  localStorage.setItem(WEEKLY_GOAL_KEY, String(hours));
}

function startOfWeek(d: Date): Date {
  // Monday-anchored week, matching the Mon..Sun axis in the mockup.
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseSessionDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function computeFocusLabStats(sessions: Session[]): FocusLabStats {
  const weeklyGoal = getWeeklyGoalHours();

  if (sessions.length === 0) {
    return {
      totalHours: 0,
      totalSessions: 0,
      avgDifficulty: 0,
      avgFocus: 0,
      avgRetention: 0,
      avgSessionMin: 0,
      weeklyGoalHours: weeklyGoal,
      weeklyGoalPct: 0,
      weekSessionCount: 0,
      dayOfWeekHours: DAY_LABELS.map((day) => ({ day, hours: 0 })),
      subjectBreakdown: [],
      strength: null,
      opportunity: null,
      tip: null,
    };
  }

  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalHours = totalMinutes / 60;
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const avgDifficulty = avg(sessions.map((s) => s.difficulty));
  const avgFocus = avg(sessions.map((s) => s.focus));
  const avgRetention = avg(sessions.map((s) => s.retention));
  const avgSessionMin = totalMinutes / sessions.length;

  // This week's window (Mon..Sun containing today)
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weekSessions = sessions.filter((s) => {
    const d = parseSessionDate(s.date);
    return d >= weekStart && d < weekEnd;
  });
  const weekHours = weekSessions.reduce((sum, s) => sum + s.duration, 0) / 60;
  const weeklyGoalPct = weeklyGoal > 0 ? Math.round((weekHours / weeklyGoal) * 100) : 0;

  const dayBuckets = new Map<string, number>(DAY_LABELS.map((d) => [d, 0]));
  for (const s of weekSessions) {
    const d = parseSessionDate(s.date);
    const idx = (d.getDay() + 6) % 7; // Mon=0..Sun=6
    const label = DAY_LABELS[idx];
    dayBuckets.set(label, (dayBuckets.get(label) ?? 0) + s.duration / 60);
  }
  const dayOfWeekHours = DAY_LABELS.map((day) => ({ day, hours: Math.round((dayBuckets.get(day) ?? 0) * 10) / 10 }));

  // Subject breakdown over all-time
  const subjectMap = new Map<string, number>();
  for (const s of sessions) {
    subjectMap.set(s.subject, (subjectMap.get(s.subject) ?? 0) + s.duration / 60);
  }
  const subjectBreakdown = [...subjectMap.entries()]
    .map(([subject, hours]) => ({ subject, hours, pctOfTotal: totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0 }))
    .sort((a, b) => b.hours - a.hours);

  // Derived insights — only stated if the data actually supports them.
  let strength: string | null = null;
  let opportunity: string | null = null;
  let tip: string | null = null;

  if (subjectBreakdown.length > 0) {
    // Strength: subject with highest avg focus among subjects with >=2 sessions
    const subjFocus = new Map<string, number[]>();
    for (const s of sessions) {
      if (!subjFocus.has(s.subject)) subjFocus.set(s.subject, []);
      subjFocus.get(s.subject)!.push(s.focus);
    }
    let bestSubject: string | null = null;
    let bestAvg = -1;
    for (const [subj, vals] of subjFocus) {
      if (vals.length < 2) continue;
      const a = avg(vals);
      if (a > bestAvg) { bestAvg = a; bestSubject = subj; }
    }
    if (bestSubject) {
      strength = `Your focus peaks during ${bestSubject} sessions, averaging ${bestAvg.toFixed(1)}/5 — your strongest subject for sustained concentration.`;
    }
  }

  // Opportunity: check if sessions logged with no explicit time-of-day data —
  // we don't track time-of-day in the schema, so instead surface something
  // we CAN actually measure: the subject with the lowest avg retention.
  if (subjectBreakdown.length > 0) {
    const subjRetention = new Map<string, number[]>();
    for (const s of sessions) {
      if (!subjRetention.has(s.subject)) subjRetention.set(s.subject, []);
      subjRetention.get(s.subject)!.push(s.retention);
    }
    let worstSubject: string | null = null;
    let worstAvg = 6;
    for (const [subj, vals] of subjRetention) {
      if (vals.length < 2) continue;
      const a = avg(vals);
      if (a < worstAvg) { worstAvg = a; worstSubject = subj; }
    }
    if (worstSubject) {
      opportunity = `Retention in ${worstSubject} averages ${worstAvg.toFixed(1)}/5, the lowest of your tracked subjects — consider shorter, more frequent review sessions.`;
    }
  }

  if (weekHours < weeklyGoal) {
    const remaining = (weeklyGoal - weekHours).toFixed(1);
    tip = `You're ${remaining}h short of your ${weeklyGoal}h weekly goal — a focused session today closes most of that gap.`;
  } else {
    tip = `You've hit your ${weeklyGoal}h weekly goal. Consider raising it or prioritizing your weakest subject for the rest of the week.`;
  }

  return {
    totalHours,
    totalSessions: sessions.length,
    avgDifficulty,
    avgFocus,
    avgRetention,
    avgSessionMin,
    weeklyGoalHours: weeklyGoal,
    weeklyGoalPct,
    weekSessionCount: weekSessions.length,
    dayOfWeekHours,
    subjectBreakdown,
    strength,
    opportunity,
    tip,
  };
}
