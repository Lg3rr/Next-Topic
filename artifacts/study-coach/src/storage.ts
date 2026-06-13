export interface Session {
  id: string;
  date: string;
  subject: string;
  duration: number;
  difficulty: number;
  focus: number;
  retention: number;
  notes: string;
}

export interface AnalysisResult {
  status: string;
  performance_level: number;        // renamed from level
  one_liner: string;
  status_reason: string;
  current_state: string;
  progress_notes: string[];
  patterns: string[];
  callouts: string[];
  key_blocker: string;
  next_action_plan: { subject: string; task: string; reason: string }[];
  // legacy fields — keep until you remove them from the UI
  improvement_points?: string[];
  weak_subjects?: string[];
  tomorrow_plan?: { subject: string; duration_minutes: number; priority: string; focus_tip: string }[];
}

const SESSIONS_KEY = "study_coach_sessions";
const ANALYSIS_KEY = "study_coach_analysis";

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
