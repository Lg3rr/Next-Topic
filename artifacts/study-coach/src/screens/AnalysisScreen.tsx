import { useState } from "react";
import { getSessions, getLastAnalysis, saveLastAnalysis, type AnalysisResult } from "../storage";
import { analyzeStudy } from "../api";

const STATUS_COLOR: Record<string, string> = {
  LOCKED_IN:    "#00ff87",
  INCONSISTENT: "#ffb800",
  STRUGGLING:   "#ff4d6d",
  COASTING:     "#a78bfa",
};

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

  const color = analysis ? (STATUS_COLOR[analysis.status] || "#fff") : "#fff";

  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#555", marginBottom: 20 }}>ANALYSIS</div>

      <button onClick={handleAnalyze} disabled={loading} style={analyzeBtn(loading)}>
        {loading ? "THINKING..." : "RUN ANALYSIS"}
      </button>

      {error && (
        <div style={{ color: "#ff4d6d", fontSize: 12, marginTop: 12 }}>{error}</div>
      )}

      {analysis && !loading && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={{ ...card, borderColor: color + "33", background: color + "0a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: "bold", color, letterSpacing: 2 }}>
                  {analysis.status}
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                  {analysis.status_reason}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: "bold", color }}>{analysis.level}</div>
                <div style={{ fontSize: 9, color: "#444", letterSpacing: 1 }}>/10</div>
              </div>
            </div>
          </div>

          <div style={{ ...card, borderColor: "rgba(255,75,75,0.15)" }}>
            <div style={{ fontSize: 11, color: "#ff6b80", fontStyle: "italic", lineHeight: 1.6 }}>
              "{analysis.one_liner}"
            </div>
          </div>

          {analysis.fake_study_warning && (
            <div style={{ ...card, borderColor: "rgba(255,184,0,0.25)" }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#ffb800", marginBottom: 6 }}>
                FAKE STUDY DETECTED
              </div>
              <div style={{ fontSize: 12, color: "#ffb80099" }}>{analysis.fake_study_reason}</div>
            </div>
          )}

          <div style={card}>
            <Section label="CALLOUTS" />
            {analysis.callouts.map((c, i) => (
              <Row key={i} icon="✗" iconColor="#ff4d6d" text={c} textColor="#cc8888" />
            ))}
          </div>

          {analysis.weak_subjects?.length > 0 && (
            <div style={card}>
              <Section label="WEAK SUBJECTS" />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {analysis.weak_subjects.map((s) => (
                  <span key={s} style={tag}>{s}</span>
                ))}
              </div>
            </div>
          )}

          <div style={card}>
            <Section label="TOMORROW'S PLAN" />
            {analysis.tomorrow_plan.map((t, i) => (
              <div key={i} style={planItem}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>{t.subject}</span>
                  <span style={{ color: "#00ff87", fontSize: 16, fontWeight: "bold" }}>
                    {t.duration_minutes}min
                  </span>
                </div>
                <div style={{ fontSize: 10, color: priorityColor(t.priority), marginBottom: 4, letterSpacing: 1 }}>
                  {t.priority}
                </div>
                <div style={{ fontSize: 11, color: "#666" }}>{t.focus_tip}</div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}

function Section({ label }: { label: string }) {
  return <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", marginBottom: 12 }}>{label}</div>;
}

function Row({ icon, iconColor, text, textColor }: { icon: string; iconColor: string; text: string; textColor: string }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
      <span style={{ color: iconColor, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, color: textColor, lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}

function priorityColor(p: string) {
  return p === "HIGH" ? "#ff4d6d" : p === "MEDIUM" ? "#ffb800" : "#555";
}

const card: React.CSSProperties = {
  padding: "14px 16px",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 6,
  background: "rgba(255,255,255,0.02)",
};

const tag: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 20,
  border: "1px solid rgba(255,107,53,0.3)",
  fontSize: 11, color: "#ff6b35",
};

const planItem: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 4, marginBottom: 8,
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.02)",
};

function analyzeBtn(loading: boolean): React.CSSProperties {
  return {
    width: "100%", padding: 14,
    background: loading ? "transparent" : "rgba(167,139,250,0.08)",
    border: "1px solid",
    borderColor: loading ? "rgba(255,255,255,0.06)" : "rgba(167,139,250,0.25)",
    color: loading ? "#555" : "#a78bfa",
    fontSize: 11, letterSpacing: 3,
    cursor: loading ? "not-allowed" : "pointer",
    borderRadius: 4, fontFamily: "inherit",
  };
}
