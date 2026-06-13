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
    {
      hours: number;
      sessions: number;
      focus: number[];
      retention: number[];
      difficulty: number[];
    }
  > = {};

  for (const s of sessions) {
    if (!map[s.subject]) {
      map[s.subject] = {
        hours: 0,
        sessions: 0,
        focus: [],
        retention: [],
        difficulty: [],
      };
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

      if (!sessions.length) {
        setError("No sessions logged yet. Add some study sessions first.");
        setLoading(false);
        return;
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

  const sessions = getSessions();
  const stats = computeStats(sessions);

  const color =
    analysis?.status && STATUS_COLOR[analysis.status]
      ? STATUS_COLOR[analysis.status]
      : "#fff";

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", fontFamily: font }}>
      <button onClick={handleAnalyze} disabled={loading} style={analyzeBtn(loading)}>
        {loading ? "Analyzing..." : "Run Analysis"}
      </button>

      {sessionCount > 0 && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#444" }}>
          Based on {sessionCount} session{sessionCount !== 1 ? "s" : ""}
        </div>
      )}

      {error && (
        <div style={{ color: "#ff4d6d", marginTop: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {!analysis && !loading && !error && (
        <div style={{ marginTop: 40, textAlign: "center", color: "#444" }}>
          Log sessions to get analysis
        </div>
      )}

      {analysis && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Status Card */}
          <div
            style={{
              padding: 20,
              borderRadius: 10,
              border: `1px solid ${color}40`,
              background: `${color}10`,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color }}>
              {analysis.status}
            </div>

            <div style={{ fontSize: 32, fontWeight: 700, color }}>
              {analysis.level ?? 0}/10
            </div>

            <div style={{ fontSize: 13, color: "#aaa" }}>
              {analysis.status_reason}
            </div>
          </div>

          {/* One liner */}
          <div style={section}>
            <div style={{ color: "#bbb", fontStyle: "italic" }}>
              "{analysis.one_liner}"
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

          {/* Improvements */}
          {analysis.improvement_points?.length > 0 && (
            <div style={section}>
              <Title>How to Improve</Title>
              {analysis.improvement_points.map((p, i) => (
                <Bullet key={i} text={p} color="#00ff87" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {stats.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <Title>Subject Stats</Title>

          {stats.map((s) => (
            <div key={s.subject} style={section}>
              <b>{s.subject}</b>
              <div style={{ fontSize: 12, color: "#666" }}>
                {s.hours.toFixed(1)} hrs • {s.sessions} sessions
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* helpers */

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

function Title({ children }: { children: React.ReactNode }) {
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
