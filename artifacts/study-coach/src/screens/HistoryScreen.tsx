import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSessions, clearSessions, deleteSession } from "../storage";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { Session } from "../storage";
import { color, font } from "../theme";

interface Props {
  onEdit: (session: Session) => void;
}

function formatDateHeader(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const { getAllSessions, deleteSession: deleteFromIndexedDB } = useLocalStorage();

  useEffect(() => {
    getAllSessions().then((allSessions) => {
      const sorted = sortOrder === "newest" 
        ? [...allSessions].reverse()
        : [...allSessions];
      setSessions(sorted);
    });
  }, [sortOrder]);

  function handleDelete(id: string) {
    if (window.confirm("Delete this session?")) {
      deleteFromIndexedDB(id).then(() => {
        deleteSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
      });
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
      <div style={{ padding: "48px 20px", textAlign: "center", fontFamily: font }}>
        <div style={{ fontSize: 15, color: color.textSecondary, marginBottom: 6 }}>No sessions logged yet</div>
        <div style={{ fontSize: 13, color: color.textMuted }}>Start logging to see your history</div>
      </div>
    );
  }

  const groups = groupByDate(sessions);

  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto", fontFamily: font }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: color.textPrimary }}>History</div>
          <div style={{ fontSize: 11, color: color.textMuted, marginTop: 2 }}>{sessions.length} sessions</div>
        </div>
        <motion.button
          onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
          whileTap={{ scale: 0.95 }}
          style={{
            padding: "8px 14px",
            background: color.accentDim,
            border: `1px solid ${color.accentBorder}`,
            borderRadius: 6,
            color: color.accent,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: font,
            letterSpacing: 0.5,
          }}
        >
          Sort It
        </motion.button>
      </div>
      <div style={{ fontSize: 11, color: color.textMuted, marginBottom: 16, textAlign: "right", letterSpacing: 0.5 }}>
        {sortOrder === "newest" ? "Newest First" : "Oldest First"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {groups.map(({ date, items }) => (
          <div key={date}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: color.textMuted,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 8,
              paddingBottom: 6,
              borderBottom: `1px solid ${color.border}`,
            }}>
              {formatDateHeader(date)}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <AnimatePresence initial={false}>
                {items.map((s, i) => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: -8 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    style={card}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: color.textPrimary }}>{s.subject}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: color.textMuted }}>{s.duration}min</span>
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
                        color: color.textSecondary,
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as const,
                        overflow: "hidden",
                      }}>
                        {s.notes}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
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
    <div style={{ fontSize: 12, color: color.textMuted }}>
      {label}: <span style={{ color: color.textSecondary, fontWeight: 600 }}>{value}/5</span>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: "14px 16px",
  background: color.bgCard,
  border: `1px solid ${color.border}`,
  borderRadius: 14,
};

const editBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: color.textMuted,
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
  color: color.textFaint,
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
  border: "1px solid rgba(248,113,113,0.25)",
  color: "rgba(248,113,113,0.6)",
  fontSize: 12,
  cursor: "pointer",
  borderRadius: 999,
  fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
};