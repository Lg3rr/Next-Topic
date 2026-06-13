import { useState } from "react";
import { getSessions, getLastAnalysis, saveLastAnalysis, type AnalysisResult, type Session } from "../storage";
import { analyzeStudy } from "../api";

const STATUS_COLOR: Record<string, string> = {
  LOCKED_IN:    "#00ff87",
  INCONSISTENT: "#ffb800",
  STRUGGLING:   "#ff4d6d",
  COASTING:     "#a78bfa",
};

const PRIORITY_COLOR: Record<string, string> = {
  HIGH:   "#ff4d6d",
  MEDIUM: "#ffb800",
  LOW:    "#555",
};

const font = "'Inter', 'Roboto', system-ui, sans-serif";

interface SubjectStat {
  subject: string;
  hours: number;
  sessions: number;
  avgFocus: number;
  avgRetention: number;
  avgDifficulty: number;
}

function computeStats(sessions: Session[]): SubjectStat[] {
  const map: Record<string, { hours: number; sessions: number; focus: number[]; retention: number[]; difficulty: number[] }> = {};
  for (const s of sessions) {
    if (!map[s.subject]) map[s.subject] = { hours: 0, sessions: 0, focus: [], retention: [], difficulty: [] };
    map[s.subject].hours += s.duration / 60;
    map[s.subject].sessions += 1;
    map[s.subject].focus.push(s.focus);
    map[s.subject].retention.push(s.retention);
    map[s.subject].difficulty.push(s.difficulty);
  }
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  return Object.entries(map)
    .map(([subject, d]) => ({
      subject,
      hours: d.hours,
      sessions: d.sessions,
      avgFocus: avg(d.focus),
      avgRetention: avg(d.retention),
      avgDifficulty: avg(d.difficulty),
    }))
    .sort((a, b) => b.hours - a.hours);
}

export default function AnalysisScreen() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(() => getLastAnalysis());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(() => getSessions().length);

  async function handleAnalyze() {
  setLoading(true);
  setError(null);

  try {
    const sessions = getSessions();

    if (sessions.length === 0) {
      setError("No sessions logged yet. Add some study sessions first.");
      setLoading(false);
      return;
    }

    const result = await analyzeStudy(sessions);

    console.log("RAW RESULT:", result);

    saveLastAnalysis(result);
    setAnalysis(result);

  } catch (e) {
    setError(e instanceof Error ? e.message : "Unknown error");
  }

  setLoading(false);
}
      setSessionCount(sessions.length);
      const result = await analyzeStudy(sessions);
      saveLastAnalysis(result);
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  }

  const color = analysis ? (STATUS_COLOR[analysis.status] ?? "#fff") : "#fff";
  const allSessions = getSessions();
  const stats = computeStats(allSessions);

  const mostStudied = stats.length > 0 ? stats.reduce((a, b) => a.hours > b.hours ? a : b) : null;
  const highestFocus = stats.length > 0 ? stats.reduce((a, b) => a.avgFocus > b.avgFocus ? a : b) : null;
  const highestRetention = stats.length > 0 ? stats.reduce((a, b) => a.avgRetention > b.avgRetention ? a : b) : null;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto", fontFamily: font }}>

      {/* Run button + session badge */}
      <div style={{ marginBottom: 4 }}>
        <button onClick={handleAnalyze} disabled={loading} style={analyzeBtn(loading)}>
          {loading ? "Analyzing your sessions..." : "Run Analysis"}
        </button>
        {sessionCount > 0 && (
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#3a3a3a" }}>
            Analysis based on {sessionCount} session{sessionCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: "#ff4d6d", fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>{error}</div>
      )}

      {!analysis && !loading && !error && (
        <div style={{ marginTop: 48, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#444" }}>Log sessions to get your analysis</div>
        </div>
      )}

      {analysis && !loading && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Status block */}
          <div style={{ ...section, borderColor: color + "30", background: color + "0a", textAlign: "center", padding: "24px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: 1, marginBottom: 4 }}>
              {analysis.status}
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color, marginBottom: 10 }}>
              {analysis.level ?? 0}<span style={{ fontSize: 16, color: color + "80", fontWeight: 400 }}>/10</span>
            </div>
            <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
              {analysis.status_reason || "No analysis available"}
            </div>
          </div>

          {/* One-liner */}
          <div style={{ ...section, borderColor: "rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 13, color: "#bbb", fontStyle: "italic", lineHeight: 1.7 }}>
              "{analysis.one_liner || ""}"
            </div>
          </div>

          {/* Patterns */}
          {analysis.patterns?.length > 0 && (
            <div style={section}>
              <SectionTitle>Patterns</SectionTitle>
              {analysis.patterns.map((p, i) => <Bullet key={i} color="#00b4d8" text={p} />)}
            </div>
          )}

          {/* Key Issues */}
          {analysis.callouts?.length > 0 && (
            <div style={section}>
              <SectionTitle>Key Issues</SectionTitle>
              {analysis.callouts.map((c, i) => <Bullet key={i} color="#ff4d6d" text={c} />)}
            </div>
          )}

          {/* How to Improve */}
          {analysis.improvement_points?.length > 0 && (
            <div style={section}>
              <SectionTitle>How to Improve</SectionTitle>
              {analysis.improvement_points.map((p, i) => <Bullet key={i} color="#00ff87" text={p} />)}
            </div>
          )}

          {/* Weak Subjects */}
          {analysis.weak_subjects?.length > 0 && (
            <div style={section}>
              <SectionTitle>Weak Subjects</SectionTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {analysis.weak_subjects.map((s) => <span key={s} style={pill}>{s}</span>)}
              </div>
            </div>
          )}

          {/* Tomorrow's Plan */}
          {analysis.tomorrow_plan?.length > 0 && (
            <div style={section}>
              <SectionTitle>Tomorrow's Plan</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                {analysis.tomorrow_plan.map((t, i) => (
                  <div key={i} style={planCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{t.subject}</span>
                        <span style={{ fontSize: 12, color: "#666" }}>{t.duration_minutes}min</span>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: PRIORITY_COLOR[t.priority] ?? "#555",
                        letterSpacing: 0.5,
                        padding: "2px 8px",
                        border: `1px solid ${PRIORITY_COLOR[t.priority] ?? "#555"}40`,
                        borderRadius: 4,
                      }}>
                        {t.priority}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>{t.focus_tip}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Subject Statistics */}
      {stats.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#444", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>
            Subject Statistics
          </div>

          {/* Quick Insights */}
          <div style={{ ...section, marginBottom: 12, borderColor: "rgba(255,255,255,0.05)" }}>
            <SectionTitle>Quick Insights</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {mostStudied && (
                <div style={{ fontSize: 12, color: "#555" }}>
                  Most Studied: <span style={{ color: "#aaa", fontWeight: 500 }}>{mostStudied.subject}</span>
                </div>
              )}
              {highestFocus && (
                <div style={{ fontSize: 12, color: "#555" }}>
                  Highest Focus: <span style={{ color: "#aaa", fontWeight: 500 }}>{highestFocus.subject}</span>
                </div>
              )}
              {highestRetention && (
                <div style={{ fontSize: 12, color: "#555" }}>
                  Highest Retention: <span style={{ color: "#aaa", fontWeight: 500 }}>{highestRetention.subject}</span>
                </div>
              )}
            </div>
          </div>

          {/* Per-subject cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stats.map((s) => (
              <div key={s.subject} style={{ ...section, borderColor: "rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", marginBottom: 10 }}>{s.subject}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
                  <StatItem label="Total Hours" value={s.hours.toFixed(1)} />
                  <StatItem label="Sessions" value={String(s.sessions)} />
                  <StatItem label="Avg Focus" value={s.avgFocus.toFixed(1)} />
                  <StatItem label="Avg Retention" value={s.avgRetention.toFixed(1)} />
                  <StatItem label="Avg Difficulty" value={s.avgDifficulty.toFixed(1)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 12, color: "#555" }}>
      {label}: <span style={{ color: "#aaa", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "#555", letterSpacing: 0.8, marginBottom: 10, textTransform: "uppercase" as const }}>
      {children}
    </div>
  );
}

function Bullet({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
      <span style={{ color, fontSize: 14, flexShrink: 0, marginTop: 1 }}>•</span>
      <span style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}

const section: React.CSSProperties = {
  padding: "16px",
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 10,
};

const pill: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: 20,
  border: "1px solid rgba(255,107,53,0.3)",
  fontSize: 12,
  color: "#ff6b35",
  fontFamily: font,
};

const planCard: React.CSSProperties = {
  padding: "12px 14px",
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 8,
};

function analyzeBtn(loading: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "15px 0",
    background: loading ? "transparent" : "rgba(167,139,250,0.1)",
    border: "1px solid",
    borderColor: loading ? "rgba(255,255,255,0.06)" : "rgba(167,139,250,0.3)",
    color: loading ? "#444" : "#a78bfa",
    fontSize: 14,
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    borderRadius: 8,
    fontFamily: font,
    letterSpacing: 0.3,
  };
}
