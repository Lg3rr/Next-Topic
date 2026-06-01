import { useState } from "react";
import { getSessions, clearSessions } from "../storage";

export default function HistoryScreen() {
  const [sessions, setSessions] = useState(() => [...getSessions()].reverse());

  function handleClear() {
    if (window.confirm("Delete all sessions?")) {
      clearSessions();
      setSessions([]);
    }
  }

  if (sessions.length === 0) {
    return (
      <div style={{ padding: "24px 20px", color: "#444", fontSize: 13 }}>
        No sessions logged yet.
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#555", marginBottom: 20 }}>
        HISTORY — {sessions.length} sessions
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.map((s) => (
          <div key={s.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>{s.subject}</span>
              <span style={{ color: "#444", fontSize: 11 }}>{s.date} · {s.duration}min</span>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <Stat label="DIFF" value={s.difficulty} color="#ff6b35" />
              <Stat label="FOCUS" value={s.focus} color="#00b4d8" />
              <Stat label="RET" value={s.retention} color="#a78bfa" />
            </div>
            {s.notes ? (
              <div style={{ fontSize: 11, color: "#555", marginTop: 8, fontStyle: "italic" }}>
                "{s.notes}"
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <button onClick={handleClear} style={clearBtn}>CLEAR ALL DATA</button>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ fontSize: 10, color: "#555" }}>
      {label} <span style={{ color }}>{value}/5</span>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: "14px 16px",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 6,
  background: "rgba(255,255,255,0.02)",
};

const clearBtn: React.CSSProperties = {
  marginTop: 24, padding: "8px 16px",
  background: "transparent",
  border: "1px solid rgba(255,77,109,0.2)",
  color: "rgba(255,77,109,0.5)",
  fontSize: 10, letterSpacing: 2,
  cursor: "pointer", borderRadius: 4,
  fontFamily: "inherit",
};
