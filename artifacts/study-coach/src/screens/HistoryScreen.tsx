import { useState } from "react";
import { getSessions, clearSessions, deleteSession } from "../storage";
import type { Session } from "../storage";

interface Props {
  onEdit: (session: Session) => void;
}

function formatDateHeader(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function groupByDate(sessions: Session[]): { date: string; items: Session[] }[] {
  const map: Record<string, Session[]> = {};
  for (const s of sessions) {
    if (!map[s.date]) map[s.date] = [];
    map[s.date].push(s);
  }
  return Object.entries(map)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, items]) => ({ date, items }));
}

export default function HistoryScreen({ onEdit }: Props) {
  const [sessions, setSessions] = useState<Session[]>(() => [...getSessions()].reverse());

  function handleDelete(id: string) {
    if (window.confirm("Delete this session?")) {
      deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  }

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

  const groups = groupByDate(sessions);

  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto", fontFamily: "'Inter', 'Roboto', system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#e0e0e0" }}>History</div>
        <div style={{ fontSize: 12, color: "#444" }}>{sessions.length} sessions</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {groups.map(({ date, items }) => (
          <div key={date}>
            {/* Date header */}
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#444",
              letterSpacing: 0.5,
              textTransform: "uppercase",
              marginBottom: 8,
              paddingBottom: 6,
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
              {formatDateHeader(date)}
            </div>

            {/* Session cards for this date */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((s) => (
                <div key={s.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{s.subject}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#555" }}>{s.duration}min</span>
                      <button onClick={() => onEdit(s)} title="Edit session" style={editBtn}>✎</button>
                      <button onClick={() => handleDelete(s.id)} title="Delete session" style={deleteBtn}>✕</button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 16, marginBottom: s.notes ? 10 : 0 }}>
                    <Metric label="D" value={s.difficulty} />
                    <Metric label="F" value={s.focus} />
                    <Metric label="R" value={s.retention} />
                  </div>

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

const editBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#444",
  fontSize: 13,
  cursor: "pointer",
  padding: "2px 4px",
  lineHeight: 1,
  borderRadius: 4,
  fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
  flexShrink: 0,
};

const deleteBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#3a3a3a",
  fontSize: 11,
  cursor: "pointer",
  padding: "2px 4px",
  lineHeight: 1,
  borderRadius: 4,
  fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
  flexShrink: 0,
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
