import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { addSession, updateSession, getSessions, getLastAnalysis } from "../storage";
import type { Session } from "../storage";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { color } from "../theme";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function clampDate(value: string): string {
  const today = todayStr();
  const min = new Date();
  min.setDate(min.getDate() - 7);
  const minStr = min.toISOString().split("T")[0];
  if (!value || value > today || value < minStr) return today;
  return value;
}

const SUBJECT_GROUPS: { group: string; subjects: string[] }[] = [
  { group: "Science", subjects: ["Physics", "Chemistry", "Biology", "Math"] },
  { group: "Commerce", subjects: ["Accountancy", "Business Studies", "Economics", "Entrepreneurship", "Finance", "Marketing", "Banking", "Taxation"] },
  { group: "Arts / Humanities", subjects: ["History", "Political Science", "Geography", "Sociology", "Psychology", "Philosophy", "Literature", "Fine Arts", "Music"] },
  { group: "Tech / Skills", subjects: ["Programming", "Computer Science", "AI / Machine Learning", "Web Development", "Data Science", "Graphic Design"] },
  { group: "Languages", subjects: ["English", "Hindi", "Bengali", "Sanskrit", "German", "French", "Other Language"] },
  { group: "General", subjects: ["Revision", "Other"] },
];

interface TooltipData {
  title: string;
  desc: string;
  lines: string[];
}

const TOOLTIPS: Record<string, TooltipData> = {
  Focus: {
    title: "Focus",
    desc: "How well were you able to concentrate during this study session?",
    lines: [
      "1 — Constantly distracted",
      "2 — Frequently distracted",
      "3 — Average focus",
      "4 — Mostly focused",
      "5 — Completely focused",
    ],
  },
  Retention: {
    title: "Retention",
    desc: "How much of the material do you feel you understood and can recall?",
    lines: [
      "1 — Remembered very little",
      "2 — Remembered some concepts",
      "3 — Understood most concepts",
      "4 — Can recall most material",
      "5 — Can confidently explain the topic",
    ],
  },
  Difficulty: {
    title: "Difficulty",
    desc: "How difficult did the topic feel while studying?",
    lines: [
      "1 — Very easy",
      "2 — Easy",
      "3 — Moderate",
      "4 — Hard",
      "5 — Very challenging",
    ],
  },
};

function getRecentSubjects(): string[] {
  const sessions = getSessions();
  const seen = new Set<string>();
  const recent: string[] = [];
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i].subject;
    if (!seen.has(s)) { seen.add(s); recent.push(s); }
    if (recent.length >= 3) break;
  }
  return recent;
}

function RatingRow({
  label,
  value,
  onChange,
  onHelp,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onHelp: () => void;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 11, letterSpacing: 1, color: color.textMuted, fontFamily: "inherit", textTransform: "uppercase" as const }}>{label}</span>
        <button
          onClick={onHelp}
          style={{
            background: "transparent",
            border: `1px solid ${color.border}`,
            color: color.textMuted,
            fontSize: 9,
            width: 16,
            height: 16,
            borderRadius: "50%",
            cursor: "pointer",
            padding: 0,
            lineHeight: "14px",
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >
          ?
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const isActive = value === n;
          return (
            <motion.button
              key={n}
              onClick={() => onChange(n)}
              whileTap={{ scale: 0.92 }}
              animate={{
                backgroundColor: isActive ? color.accentDim : "rgba(0,0,0,0.3)",
                borderColor: isActive ? color.accentBorder : color.border,
                color: isActive ? color.accentBright : color.textMuted,
                scale: isActive ? 1.04 : 1,
              }}
              transition={{ duration: 0.15 }}
              style={{
                flex: 1,
                padding: "11px 0",
                border: "1px solid",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: isActive ? 700 : 400,
                fontFamily: "inherit",
              }}
            >
              {n}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

const emptyForm = {
  subject: "Math",
  date: todayStr(),
  duration: 60,
  difficulty: 3,
  focus: 3,
  retention: 3,
  notes: "",
};

interface Props {
  editSession: Session | null;
  onEditDone: () => void;
  onSessionSaved: (session: Session) => void;
}

export default function LogScreen({ editSession, onEditDone, onSessionSaved }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<TooltipData | null>(null);
  const { saveSession } = useLocalStorage();
  const recentSubjects = getRecentSubjects();
  
  useEffect(() => {
    if (editSession) {
      setForm({
        subject: editSession.subject,
        date: editSession.date,
        duration: editSession.duration,
        difficulty: editSession.difficulty,
        focus: editSession.focus,
        retention: editSession.retention,
        notes: editSession.notes,
      });
    } else {
      setForm({ ...emptyForm, date: todayStr() });
    }
    setSaved(false);
  }, [editSession]);

  async function handleSubmit() {
    if (editSession) {
      updateSession({ ...editSession, ...form });
      onEditDone();
    } else {
      const session: Session = { id: String(Date.now()), ...form };
      addSession(session);
      setForm({ ...emptyForm, date: todayStr() });
      setSaved(true);
      onSessionSaved(session);
      
      // Auto-save to IndexedDB
      await saveSession(session);
    }
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto", fontFamily: "'Inter', 'Roboto', system-ui, sans-serif" }}>

      {/* Tooltip modal */}
      <AnimatePresence>
        {activeTooltip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveTooltip(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(0,0,0,0.7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 24px",
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: color.bgCard,
                border: `1px solid ${color.border}`,
                borderRadius: 14,
                padding: "24px 20px",
                maxWidth: 360,
                width: "100%",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: color.textPrimary, marginBottom: 8 }}>{activeTooltip.title}</div>
              <div style={{ fontSize: 12, color: color.textMuted, lineHeight: 1.6, marginBottom: 14 }}>{activeTooltip.desc}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {activeTooltip.lines.map((line) => (
                  <div key={line} style={{ fontSize: 12, color: color.textSecondary, lineHeight: 1.5 }}>{line}</div>
                ))}
              </div>
              <button
                onClick={() => setActiveTooltip(null)}
                style={{
                  marginTop: 20, width: "100%", padding: "10px 0",
                  background: "transparent", border: `1px solid ${color.border}`,
                  color: color.textSecondary, fontSize: 13, cursor: "pointer", borderRadius: 8,
                  fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
                }}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: color.textPrimary, marginBottom: 4 }}>
          {editSession ? "Editing Session" : "Log Session"}
        </div>
        <div style={{ fontSize: 12, color: color.textMuted }}>
          {editSession
            ? "Update the fields below and save your changes"
            : "Log your last study session (takes ~30 seconds)"}
        </div>
      </div>

      {/* Subject */}
      <div style={{ marginBottom: 24 }}>
        <div style={labelStyle}>Subject</div>
        <select
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          style={selectStyle}
        >
          {recentSubjects.length > 0 && (
            <optgroup label="Recently Used">
              {recentSubjects.map((s) => (
                <option key={`recent-${s}`} value={s}>{s}</option>
              ))}
            </optgroup>
          )}
          {SUBJECT_GROUPS.map(({ group, subjects }) => (
            <optgroup key={group} label={group}>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Date */}
      <div style={{ marginBottom: 24 }}>
        <div style={labelStyle}>Date</div>
        <input
          type="date"
          value={form.date}
          max={todayStr()}
          onChange={(e) => setForm((f) => ({ ...f, date: clampDate(e.target.value) }))}
          style={{ ...selectStyle, colorScheme: "dark" }}
        />
        {form.date !== todayStr() && (
          <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>Logging for {form.date}</div>
        )}
      </div>

      {/* Duration */}
      <div style={{ marginBottom: 28 }}>
        <div style={labelStyle}>
          Duration — <span style={{ color: color.accentBright, fontWeight: 700 }}>{form.duration} min</span>
        </div>
        <input
          type="range" min={5} max={300} step={5}
          value={form.duration}
          onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
          style={{ width: "100%", accentColor: color.accent, marginTop: 4 }}
        />
      </div>

      <RatingRow
        label="Difficulty"
        value={form.difficulty}
        onChange={(v) => setForm((f) => ({ ...f, difficulty: v }))}
        onHelp={() => setActiveTooltip(TOOLTIPS.Difficulty)}
      />
      <RatingRow
        label="Focus"
        value={form.focus}
        onChange={(v) => setForm((f) => ({ ...f, focus: v }))}
        onHelp={() => setActiveTooltip(TOOLTIPS.Focus)}
      />
      <RatingRow
        label="Retention"
        value={form.retention}
        onChange={(v) => setForm((f) => ({ ...f, retention: v }))}
        onHelp={() => setActiveTooltip(TOOLTIPS.Retention)}
      />

      {/* Honesty hint */}
      <div style={{ fontSize: 11, color: color.textFaint, marginBottom: 24, marginTop: -8 }}>
        Rate honestly. These ratings improve AI analysis accuracy.
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 28 }}>
        <div style={labelStyle}>Notes</div>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="What happened? (problems, mistakes, thoughts)"
          rows={3}
          style={{ ...selectStyle, resize: "vertical" as const, lineHeight: 1.6 }}
        />
      </div>

      <motion.button
        onClick={handleSubmit}
        whileTap={{ scale: 0.98 }}
        animate={saved ? { backgroundColor: color.accent, color: "#06140c" } : {}}
        style={primaryBtn}
      >
        {editSession ? "Save Changes" : (saved ? "✓ Saved" : "Log Session")}
      </motion.button>

      {editSession && (
        <button onClick={onEditDone} style={cancelBtn}>Cancel</button>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: color.textSecondary, marginBottom: 8, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" as const,
};

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "13px 16px",
  background: color.bgInput,
  border: `1px solid ${color.border}`,
  color: color.textPrimary, fontSize: 14, borderRadius: 12,
  fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  width: "100%", padding: "16px 0",
  background: color.accentDim,
  border: `1px solid ${color.accentBorder}`,
  color: color.textPrimary, fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
  cursor: "pointer", borderRadius: 999,
  fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
};

const cancelBtn: React.CSSProperties = {
  width: "100%", marginTop: 10, padding: "14px 0",
  background: "transparent",
  border: `1px solid ${color.border}`,
  color: color.textMuted, fontSize: 14, cursor: "pointer", borderRadius: 999,
  fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
};
