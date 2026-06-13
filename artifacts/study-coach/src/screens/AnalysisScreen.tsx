import { useState } from "react";
import {
  getSessions,
  getLastAnalysis,
  saveLastAnalysis,
  type AnalysisResult,
  type Session,
} from "../storage";
import { analyzeStudy } from "../api";

const STATUS_COLOR: Record<string, string> = {
  LOCKED_IN: "#00ff87",
  INCONSISTENT: "#ffb800",
  STRUGGLING: "#ff4d6d",
  COASTING: "#a78bfa",
};

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "#ff4d6d",
  MEDIUM: "#ffb800",
  LOW: "#555",
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
  const map: Record<
    string,
    { hours: number; sessions: number; focus: number[]; retention: number[]; difficulty: number[] }
  > = {};

  for (const s of sessions) {
    if (!map[s.subject]) {
      map[s.subject] = { hours: 0, sessions: 0, focus: [], retention: [], difficulty: [] };
    }

    map[s.subject].hours += s.duration / 60;
    map[s.subject].sessions += 1;
    map[s.subject].focus.push(s.focus);
    map[s.subject].retention.push(s.retention);
    map[s.subject].difficulty.push(s.difficulty);
  }

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

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
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(() =>
    getLastAnalysis()
  );
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

      setSessionCount(sessions.length);

      const result = await analyzeStudy(sessions);

      console.log("RAW RESULT:", result);

      saveLastAnalysis(result);
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }

    setLoading(false);
  }

  const color = analysis ? STATUS_COLOR[analysis.status] ?? "#fff" : "#fff";
  const sessions = getSessions();
  const stats = computeStats(sessions);

  const mostStudied =
    stats.length > 0 ? stats.reduce((a, b) => (a.hours > b.hours ? a : b)) : null;

  const highestFocus =
    stats.length > 0 ? stats.reduce((a, b) => (a.avgFocus > b.avgFocus ? a : b)) : null;

  const highestRetention =
    stats.length > 0
      ? stats.reduce((a, b) => (a.avgRetention > b.avgRetention ? a : b))
      : null;

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", fontFamily: font }}>

      {/* Button */}
      <button onClick={handleAnalyze} disabled={loading} style={analyzeBtn(loading)}>
        {loading ? "Analyzing..." : "Run Analysis"}
      </button>

      {sessionCount > 0 && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#444" }}>
          Based on {sessionCount} session{sessionCount !== 1 ? "s" : ""}
        </div>
      )}

      {error && (
        <div style={{ color: "#ff4d6d", marginTop: 12, fontSize: 13 }}>{error}</div>
      )}

      {!analysis && !loading && !error && (
        <div style={{ marginTop: 40, textAlign: "center", color: "#444" }}>
          Log sessions to get analysis
        </div>
      )}

      {analysis && !loading && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Status */}
          <div
            style={{
              padding: 20,
              borderRadius: 10,
              border: `1px solid ${color}40`,
              background: `${color}10`,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{analysis.status}</div>

            <div style={{ fontSize: 32, fontWeight: 700, color }}>
              {analysis.level ?? 0}
              <span style={{ fontSize: 16, opacity: 0.7 }}>/10</span>
            </div>

            <div style={{ fontSize: 13, color: "#aaa" }}>
              {analysis.status_reason || "No reason"}
            </div>
          </div>

          {/* One liner */}
          <div style={section}>
            <div style={{ color: "#bbb", fontStyle: "italic" }}>
              "{analysis.one_liner || ""}"
            </div>
          </div>

          {/* Patterns */}
          {analysis.patterns?.length > 0 && (
            <div style={section}>
              <Title>Patterns</Title>
              {analysis.patterns.map((p, i) => (
                <Bullet key={i} text={p} color="#00b4d8" />
              ))}
            </div>
          )}

          {/* Callouts */}
          {analysis.callouts?.length > 0 && (
            <div style={section}>
              <Title>Key Issues</Title>
              {analysis.callouts.map((c, i) => (
                <Bullet key={i} text={c} color="#ff4d6d" />
              ))}
            </div>
          )}

          {/* Improve */}
          {analysis.improvement_points?.length > 0 && (
            <div style={section}>
              <Title>Improve</Title>
              {analysis.improvement_points.map((p, i) => (
                <Bullet key={i} text={p} color="#00ff87" />
              ))}
            </div>
          )}

          {/* Weak */}
          {analysis.weak_subjects?.length > 0 && (
            <div style={section}>
              <Title>Weak Subjects</Title>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {analysis.weak_subjects.map((s) => (
                  <span key={s} style={pill}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Plan */}
          {analysis.tomorrow_plan?.length > 0 && (
            <div style={section}>
              <Title>Tomorrow Plan</Title>
              {analysis.tomorrow_plan.map((t, i) => (
                <div key={i} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <b>{t.subject}</b>
                    <span style={{ color: "#666" }}>{t.duration_minutes} min</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>{t.focus_tip}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {stats.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <Title>Subject Stats</Title>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stats.map((s) => (
              <div key={s.subject} style={section}>
                <b>{s.subject}</b>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Hours: {s.hours.toFixed(1)} | Sessions: {s.sessions}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* UI helpers */

function analyzeBtn(loading: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: 14,
    borderRadius: 8,
    border: "1px solid #555",
    background: loading ? "#111" : "#1a1a1a",
    color: "#fff",
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
  };
}

const section: React.CSSProperties = {
  padding: 14,
  border: "1px solid #222",
  borderRadius: 10,
  marginBottom: 10,
};

function Title({ children }: any) {
  return (
    <div style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Bullet({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
      <span style={{ color }}>•</span>
      <span style={{ color: "#bbb", fontSize: 13 }}>{text}</span>
    </div>
  );
}

const pill: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 20,
  border: "1px solid #333",
  fontSize: 12,
  color: "#aaa",
};

const card: React.CSSProperties = {
  padding: 10,
  border: "1px solid #222",
  borderRadius: 8,
  marginTop: 8,
};
