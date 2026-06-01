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
  status: "LOCKED_IN" | "INCONSISTENT" | "STRUGGLING" | "COASTING";
  status_reason: string;
  level: number;
  one_liner: string;
  fake_study_warning: boolean;
  fake_study_reason: string;
  callouts: string[];
  weak_subjects: string[];
  tomorrow_plan: {
    subject: string;
    duration_minutes: number;
    priority: "HIGH" | "MEDIUM" | "LOW";
    focus_tip: string;
  }[];
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
