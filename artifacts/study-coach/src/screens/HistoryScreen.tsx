import { useState } from "react";
import { getSessions, clearSessions } from "../storage";

export default function HistoryScreen() {
  const [sessions, setSessions] = useState(() => [...getSessions()].reverse());

  function handleClear() {
    if (window.confirm("Are you sure you want to delete all sessions?")) {
      clearSessions();
      setSessions([]);
    }
  }

  if (sessions.length === 0) {
    return (
      <div style={{ padding: "48px 20px", textAlign: "center", fontFamily: "'Inter', 'Roboto', system-ui, sans-serif" }}>
        <div style={{ fontSize: 15, color: "#888", marginBottom: 6 }}>No sessions logged yet</div>
        <div style={{ fontSize: 13, color: "#444" }}>Start logging to see your history</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto", fontFamily: "'Inter', 'Roboto', system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#e0e0e0" }}>History</div>
        <div style={{ fontSize: 12, color: "#444" }}>{sessions.length} sessions</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sessions.map((s) => (
          <div key={s.id} style={card}>
            {/* Top row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{s.subject}</span>
              <span style={{ fontSize: 11, color: "#555" }}>{s.date} · {s.duration}min</span>
            </div>

            {/* Metrics row */}
            <div style={{ display: "flex", gap: 16, marginBottom: s.notes ? 10 : 0 }}>
              <Metric label="D" value={s.difficulty} />
              <Metric label="F" value={s.focus} />
              <Metric label="R" value={s.retention} />
            </div>

            {/* Notes */}
            {s.notes && (
              <div style={{
                fontSize: 12,
                color: "#555",
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }}>
                {s.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, textAlign: "center" }}>
        <button onClick={handleClear} style={clearBtn}>Delete all sessions</button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ fontSize: 12, color: "#555" }}>
      {label}: <span style={{ color: "#aaa", fontWeight: 500 }}>{value}/5</span>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: "14px 16px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 10,
};

const clearBtn: React.CSSProperties = {
  padding: "8px 18px",
  background: "transparent",
  border: "1px solid rgba(255,80,80,0.2)",
  color: "rgba(255,100,100,0.45)",
  fontSize: 12,
  cursor: "pointer",
  borderRadius: 6,
  fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
};
