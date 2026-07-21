import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getSessions,
  getLastAnalysis,
  saveLastAnalysis,
  getAISummary,
  saveAISummary,
  getCooldown,
  setCooldown,
  clearCooldown,
  getAdvancedInsights,
  saveAdvancedInsights,
  type AnalysisResult,
  type Session,
  type AISummary,
  type AdvancedInsights,
} from "../storage";
import { analyzeStudy, type AnalyzeResponse } from "../api";
import { color } from "../theme";

const STATUS_COLOR: Record<string, string> = {
  LOCKED_IN:    color.accentBright,
  INCONSISTENT: color.amber,
  STRUGGLING:   color.red,
  COASTING:     "#a78bfa",
};

const PRIORITY_COLOR: Record<string, string> = {
  HIGH:   color.red,
  MEDIUM: color.amber,
  LOW:    color.textMuted,
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

function normalizeStatus(raw: string): string {
  return raw?.trim().toUpperCase().replace(/\s+/g, "_") ?? "INCONSISTENT";
}

export default function AnalysisScreen() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(() => getLastAnalysis());
  const [insights, setInsights] = useState<AdvancedInsights | null>(() => getAdvancedInsights());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(() => getSessions().length);
  const [cooldownMs, setCooldownMs] = useState<number | null>(null);

  useEffect(() => {
    const cooldown = getCooldown();
    if (cooldown) {
      const remaining = Math.max(0, cooldown.endsAt - Date.now());
      if (remaining > 0) {
        setCooldownMs(remaining);
        const interval = setInterval(() => {
          setCooldownMs((prev) => {
            if (!prev || prev <= 0) {
              clearInterval(interval);
              clearCooldown();
              return null;
            }
            return prev - 1000;
          });
        }, 1000);
        return () => clearInterval(interval);
      } else {
        clearCooldown();
      }
    }
    return undefined;
  }, []);

  async function handleAnalyze() {
    console.log("[ANALYZE] Button pressed");
    console.log("[ANALYZE] loading:", loading, "cooldownMs:", cooldownMs);
    
    if (loading || cooldownMs) {
      console.log("[ANALYZE] Early return: loading=" + loading + ", cooldownMs=" + cooldownMs);
      return;
    }

    console.log("[ANALYZE] Starting analysis...");
    setLoading(true);
    console.log("[ANALYZE] setLoading(true) called");
    
    setError(null);
    console.log("[ANALYZE] setError(null) called");
    
    try {
      console.log("[ANALYZE] Inside try block");
      
      const sessions = getSessions();
      console.log("[ANALYZE] getSessions() returned:", sessions.length, "sessions");
      
      if (sessions.length === 0) {
        console.log("[ANALYZE] VALIDATION: No sessions - setting error and returning");
        setError("No sessions logged yet. Add some study sessions first.");
        setLoading(false);
        console.log("[ANALYZE] setLoading(false) called (no sessions path)");
        return;
      }
      
      console.log("[ANALYZE] Validation passed - sessions exist");
      setSessionCount(sessions.length);
      console.log("[ANALYZE] setSessionCount called");
      
      const aiSummary = getAISummary();
      console.log("[ANALYZE] getAISummary() returned:", aiSummary);
      
      console.log("[ANALYZE] About to call analyzeStudy()");
      console.log("[ANALYZE] Request payload: sessions count =", sessions.length, ", aiSummary =", aiSummary);
      
      const response = await analyzeStudy(sessions, undefined, aiSummary);
      
      console.log("[ANALYZE] analyzeStudy() completed successfully");
      console.log("[ANALYZE] Response received:", response);

      if (!response.analysis) {
        throw new Error("Invalid response from server: Missing analysis data");
      }

      // Normalize response shape if backend sends old keys or misses fields
      const normalizedAnalysis: AnalysisResult = {
        status: response.analysis.status || "INCONSISTENT",
        performance_level: response.analysis.performance_level ?? (response.analysis as any).level ?? 5,
        one_liner: response.analysis.one_liner || "Analysis complete.",
        status_reason: response.analysis.status_reason || "Based on your recent study patterns.",
        current_state: response.analysis.current_state || "Active study period.",
        progress_notes: response.analysis.progress_notes || [],
        patterns: response.analysis.patterns || [],
        callouts: response.analysis.callouts || [],
        key_blocker: response.analysis.key_blocker || "None identified.",
        improvement_points: response.analysis.improvement_points || [],
        weak_subjects: response.analysis.weak_subjects || [],
        next_action_plan: response.analysis.next_action_plan ?? (response.analysis as any).tomorrow_plan?.map((p: any) => ({
          subject: p.subject,
          task: p.task || p.focus_tip,
          reason: p.reason || `Priority: ${p.priority}`
        })) ?? []
      };
      
      saveLastAnalysis(normalizedAnalysis);
      setAnalysis(normalizedAnalysis);
      
      if (response.insights) {
        console.log("[ANALYZE] Insights exist, saving...");
        saveAdvancedInsights(response.insights);
        console.log("[ANALYZE] saveAdvancedInsights() called");
        
        setInsights(response.insights);
        console.log("[ANALYZE] setInsights() called");
      } else {
        console.log("[ANALYZE] No insights in response");
      }

      const newSummary: AISummary = {
        timestamp: Date.now(),
        longTermTrends: response.analysis.progress_notes.join("; "),
        strengths: response.analysis.patterns || [],
        weaknesses: response.analysis.callouts || [],
        recurringIssues: response.analysis.callouts || [],
        habits: response.analysis.current_state || "",
        recommendations: response.analysis.improvement_points || [],
      };
      console.log("[ANALYZE] Created newSummary:", newSummary);
      
      saveAISummary(newSummary);
      console.log("[ANALYZE] saveAISummary() called");
      
      setLoading(false);
      console.log("[ANALYZE] setLoading(false) called (success path)");
      console.log("[ANALYZE] ✅ Analysis completed successfully");
      
    } catch (e) {
      console.error("[ANALYZE] ❌ EXCEPTION CAUGHT");
      console.error("[ANALYZE] Error type:", typeof e);
      console.error("[ANALYZE] Error instanceof Error:", e instanceof Error);
      console.error("[ANALYZE] Error object:", e);
      
      if (e instanceof Error) {
        console.error("[ANALYZE] Error.message:", e.message);
        console.error("[ANALYZE] Error.stack:", e.stack);
      }
      
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      setError(errorMsg);
      
      // Only set cooldown for server errors (5xx) or rate limits, not for client-side or validation errors
      const isServerError = errorMsg.includes("500") || errorMsg.includes("503") || errorMsg.includes("Server error");
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit");
      
      if (isServerError || isRateLimit || errorMsg === "Unknown error") {
        setCooldown(Date.now() + 10 * 60 * 1000);
        setCooldownMs(10 * 60 * 1000);
      }
      
      setLoading(false);
      console.log("[ANALYZE] setLoading(false) called (catch path)");
    }
  }

  const status = analysis ? normalizeStatus(analysis.status) : "";
  const statusColor = STATUS_COLOR[status] ?? "#fff";
  const allSessions = getSessions();
  const stats = computeStats(allSessions);

  const mostStudied = stats.length > 0 ? stats.reduce((a, b) => a.hours > b.hours ? a : b) : null;
  const highestFocus = stats.length > 0 ? stats.reduce((a, b) => a.avgFocus > b.avgFocus ? a : b) : null;
  const highestRetention = stats.length > 0 ? stats.reduce((a, b) => a.avgRetention > b.avgRetention ? a : b) : null;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto", fontFamily: font }}>

      {/* Run button + session badge */}
      <div style={{ marginBottom: 4 }}>
        <motion.button
          onClick={handleAnalyze}
          disabled={loading || !!cooldownMs}
          whileTap={{ scale: 0.98 }}
          style={analyzeBtn(loading || !!cooldownMs)}
        >
          {cooldownMs
            ? `Cooldown: ${Math.ceil(cooldownMs / 1000)}s`
            : loading
              ? "Analyzing your sessions..."
              : "Run Analysis"}
        </motion.button>
        {sessionCount > 0 && (
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: color.textFaint }}>
            Analysis based on {sessionCount} session{sessionCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: color.red, fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>
          {error}
          {cooldownMs && (
            <div style={{ marginTop: 8, fontSize: 12, color: color.amber }}>
              Please try again after the cooldown expires.
            </div>
          )}
        </div>
      )}

      {!analysis && !loading && !error && (
        <div style={{ marginTop: 48, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: color.textFaint }}>Log sessions to get your analysis</div>
        </div>
      )}

      <AnimatePresence>
      {analysis && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}
        >

          {/* Status block */}
          <div style={{ ...section, borderColor: statusColor + "30", background: statusColor + "0a", textAlign: "center", padding: "24px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: statusColor, letterSpacing: 1, marginBottom: 4 }}>
              {status}
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: statusColor, marginBottom: 10 }}>
              {analysis.performance_level}<span style={{ fontSize: 16, color: statusColor + "80", fontWeight: 400 }}>/10</span>
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
          {(analysis.improvement_points?.length ?? 0) > 0 && (
            <div style={section}>
              <SectionTitle>How to Improve</SectionTitle>
              {analysis.improvement_points!.map((p, i) => <Bullet key={i} color="#00ff87" text={p} />)}
            </div>
          )}

          {/* Weak Subjects */}
          {(analysis.weak_subjects?.length ?? 0) > 0 && (
            <div style={section}>
              <SectionTitle>Weak Subjects</SectionTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {analysis.weak_subjects!.map((s) => <span key={s} style={pill}>{s}</span>)}
              </div>
            </div>
          )}

          {/* Advanced Insights */}
          {insights && insights.patterns?.length > 0 && (
            <div style={section}>
              <SectionTitle>Pattern Detection</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {insights.patterns.map((p, i) => (
                  <div key={i} style={{ fontSize: 12, borderLeft: `3px solid ${p.confidence === "High" ? color.accentBright : color.amber}`, paddingLeft: 10, color: "#aaa" }}>
                    <div style={{ fontWeight: 600, marginBottom: 2, color: "#fff" }}>
                      {p.label} <span style={{ fontSize: 10, color: "#666", fontWeight: 400 }}>({p.confidence})</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#888" }}>{p.explanation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personalized Recommendations */}
          {insights && insights.recommendations?.length > 0 && (
            <div style={section}>
              <SectionTitle>Action Items</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {insights.recommendations.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, paddingLeft: 10, borderLeft: `3px solid ${PRIORITY_COLOR[r.priority]}`, color: "#aaa" }}>
                    <div style={{ fontWeight: 600, marginBottom: 2, color: PRIORITY_COLOR[r.priority] }}>
                      {r.action}
                    </div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{r.rationale}</div>
                    {r.baselineData && <div style={{ fontSize: 10, color: "#555" }}>{r.baselineData}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* nExt action */}
          
          {analysis.next_action_plan?.length > 0 && (
  <div style={section}>
    <SectionTitle>What to Study Next</SectionTitle>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
      {analysis.next_action_plan.map((t, i) => (
        <div key={i} style={planCard}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
            {t.subject}
          </div>
          <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6, marginBottom: 6 }}>
            {t.task}
          </div>
          <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>
            {t.reason}
          </div>
        </div>
      ))}
    </div>
  </div>
)}

        </motion.div>
      )}
      </AnimatePresence>

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
  background: color.bgCard,
  border: `1px solid ${color.border}`,
  borderRadius: 14,
};

const pill: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: 999,
  border: "1px solid rgba(250,204,21,0.35)",
  fontSize: 12,
  color: color.amber,
  fontFamily: font,
};

const planCard: React.CSSProperties = {
  padding: "12px 14px",
  background: color.bgCardAlt,
  border: `1px solid ${color.border}`,
  borderRadius: 10,
};

function analyzeBtn(loading: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "15px 0",
    background: loading ? "transparent" : "rgba(167,139,250,0.12)",
    border: "1px solid",
    borderColor: loading ? color.border : "rgba(167,139,250,0.35)",
    color: loading ? color.textFaint : "#a78bfa",
    fontSize: 14,
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    borderRadius: 8,
    fontFamily: font,
    letterSpacing: 0.3,
  };
                 }
