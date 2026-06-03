import { useState } from "react";
import { getSessions, getLastAnalysis, saveLastAnalysis, type AnalysisResult } from "../storage";
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

export default function AnalysisScreen() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(() => getLastAnalysis());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      saveLastAnalysis(result);
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  }

  const color = analysis ? (STATUS_COLOR[analysis.status] ?? "#fff") : "#fff";

  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto", fontFamily: font }}>

      {/* Run button */}
      <button onClick={handleAnalyze} disabled={loading} style={analyzeBtn(loading)}>
        {loading ? "Analyzing your sessions..." : "Run Analysis"}
      </button>

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
              {analysis.level}<span style={{ fontSize: 16, color: color + "80", fontWeight: 400 }}>/10</span>
            </div>
            <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
              {analysis.status_reason}
            </div>
          </div>

          {/* One-liner */}
          <div style={{ ...section, borderColor: "rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 13, color: "#bbb", fontStyle: "italic", lineHeight: 1.7 }}>
              "{analysis.one_liner}"
            </div>
          </div>

          {/* Patterns */}
          {analysis.patterns?.length > 0 && (
            <div style={section}>
              <SectionTitle>Patterns</SectionTitle>
              {analysis.patterns.map((p, i) => (
                <Bullet key={i} color="#00b4d8" text={p} />
              ))}
            </div>
          )}

          {/* Key Issues (renamed from Callouts) */}
          {analysis.callouts?.length > 0 && (
            <div style={section}>
              <SectionTitle>Key Issues</SectionTitle>
              {analysis.callouts.map((c, i) => (
                <Bullet key={i} color="#ff4d6d" text={c} />
              ))}
            </div>
          )}

          {/* How to Improve */}
          {analysis.improvement_points?.length > 0 && (
            <div style={section}>
              <SectionTitle>How to Improve</SectionTitle>
              {analysis.improvement_points.map((p, i) => (
                <Bullet key={i} color="#00ff87" text={p} />
              ))}
            </div>
          )}

          {/* Weak Subjects */}
          {analysis.weak_subjects?.length > 0 && (
            <div style={section}>
              <SectionTitle>Weak Subjects</SectionTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {analysis.weak_subjects.map((s) => (
                  <span key={s} style={pill}>{s}</span>
                ))}
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
                        fontSize: 10,
                        fontWeight: 600,
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
  fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
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
    fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
    letterSpacing: 0.3,
  };
}
