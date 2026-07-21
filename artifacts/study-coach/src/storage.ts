export interface Session {
  id: string;
  date: string;
  subject: string;
  duration: number;
  difficulty: number;
  focus: number;
  retention: number;
  notes: string;

  interviewContext?: string;
  sessionType?: string;

}

export interface AnalysisResult {
  status: string;
  performance_level: number;
  one_liner: string;
  status_reason: string;
  current_state: string;
  progress_notes: string[];
  patterns: string[];
  callouts: string[];
  key_blocker: string;
  improvement_points?: string[];
  weak_subjects?: string[];
  next_action_plan: {
    subject: string;
    task: string;
    reason: string;
  }[];
}

export interface AISummary {
  timestamp: number;
  longTermTrends: string;
  strengths: string[];
  weaknesses: string[];
  recurringIssues: string[];
  habits: string;
  recommendations: string[];
}

export interface CooldownState {
  endsAt: number;
}

export interface PatternInsight {
  type: "weak_subject" | "strong_subject" | "consistency" | "focus_trend" | "retention_trend" | "duration_trend" | "skipped_days" | "burnout";
  label: string;
  value: string | number;
  confidence: "Low" | "Medium" | "High";
  explanation: string;
}

export interface Recommendation {
  priority: "HIGH" | "MEDIUM" | "LOW";
  action: string;
  rationale: string;
  baselineData?: string;
}

export interface TrendComparison {
  metric: string;
  thisWeek: number;
  lastWeek: number;
  change: number;
  trend: "improved" | "declined" | "stable";
}

export interface AdvancedInsights {
  timestamp: number;
  patterns: PatternInsight[];
  recommendations: Recommendation[];
  weeklyTrends?: TrendComparison[];
}

const SESSIONS_KEY = "study_coach_sessions";
const ANALYSIS_KEY = "study_coach_analysis";
const AI_SUMMARY_KEY = "study_coach_ai_summary";
const COOLDOWN_KEY = "study_coach_analysis_cooldown";
const INSIGHTS_KEY = "study_coach_advanced_insights";

export function getSessions(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addSession(session: Session): void {
  const sessions = getSessions();
  sessions.push(session);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function updateSession(session: Session): void {
  const sessions = getSessions().map((s) => (s.id === session.id ? session : s));
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function deleteSession(id: string): void {
  const sessions = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function clearSessions(): void {
  localStorage.removeItem(SESSIONS_KEY);
  localStorage.removeItem(ANALYSIS_KEY);
}

export function getLastAnalysis(): AnalysisResult | null {
  try {
    const raw = localStorage.getItem(ANALYSIS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLastAnalysis(result: AnalysisResult): void {
  localStorage.setItem(ANALYSIS_KEY, JSON.stringify(result));
}

export function getAISummary(): AISummary | null {
  try {
    const raw = localStorage.getItem(AI_SUMMARY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAISummary(summary: AISummary): void {
  localStorage.setItem(AI_SUMMARY_KEY, JSON.stringify(summary));
}

export function getCooldown(): CooldownState | null {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCooldown(endsAt: number): void {
  localStorage.setItem(COOLDOWN_KEY, JSON.stringify({ endsAt }));
}

export function clearCooldown(): void {
  localStorage.removeItem(COOLDOWN_KEY);
}

export function getAdvancedInsights(): AdvancedInsights | null {
  try {
    const raw = localStorage.getItem(INSIGHTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAdvancedInsights(insights: AdvancedInsights): void {
  localStorage.setItem(INSIGHTS_KEY, JSON.stringify(insights));
}
