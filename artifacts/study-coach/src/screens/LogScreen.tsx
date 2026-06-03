import { useState } from "react";
import { addSession } from "../storage";

const SUBJECTS = ["Math", "Physics", "Chemistry", "Biology", "History", "Literature", "Programming", "English", "Economics", "Other"];

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, color: "#666", marginBottom: 10, fontFamily: "inherit" }}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const isActive = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              style={{
                flex: 1,
                padding: "11px 0",
                border: "1px solid",
                borderColor: isActive ? "#00ff87" : "rgba(255,255,255,0.1)",
                background: isActive ? "rgba(0,255,135,0.1)" : "rgba(255,255,255,0.02)",
                color: isActive ? "#00ff87" : "#555",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                fontFamily: "inherit",
                transition: "all 0.1s ease",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LogScreen() {
  const [form, setForm] = useState({
    subject: "Math",
    duration: 60,
    difficulty: 3,
    focus: 3,
    retention: 3,
    notes: "",
  });
  const [saved, setSaved] = useState(false);

  function handleSubmit() {
    const session = {
      id: String(Date.now()),
      date: new Date().toISOString().split("T")[0],
      ...form,
    };
    addSession(session);
    setSaved(true);
    setForm({ subject: "Math", duration: 60, difficulty: 3, focus: 3, retention: 3, notes: "" });
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{
      padding: "24px 20px",
      maxWidth: 480,
      margin: "0 auto",
      fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
    }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#e0e0e0", marginBottom: 4 }}>Log Session</div>
        <div style={{ fontSize: 12, color: "#444" }}>Log your last study session (takes ~30 seconds)</div>
      </div>

      {/* Subject */}
      <div style={{ marginBottom: 24 }}>
        <div style={labelStyle}>Subject</div>
        <select
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          style={selectStyle}
        >
          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Duration */}
      <div style={{ marginBottom: 28 }}>
        <div style={labelStyle}>
          Duration — <span style={{ color: "#00ff87", fontWeight: 600 }}>{form.duration} min</span>
        </div>
        <input
          type="range" min={5} max={300} step={5}
          value={form.duration}
          onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
          style={{ width: "100%", accentColor: "#00ff87", marginTop: 4 }}
        />
      </div>

      <RatingRow label="Difficulty" value={form.difficulty} onChange={(v) => setForm((f) => ({ ...f, difficulty: v }))} />
      <RatingRow label="Focus" value={form.focus} onChange={(v) => setForm((f) => ({ ...f, focus: v }))} />
      <RatingRow label="Retention" value={form.retention} onChange={(v) => setForm((f) => ({ ...f, retention: v }))} />

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

      <button onClick={handleSubmit} style={primaryBtn}>
        {saved ? "✓ Saved" : "Log Session"}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#888",
  marginBottom: 8,
  fontWeight: 500,
  letterSpacing: 0.2,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#e0e0e0",
  fontSize: 14,
  borderRadius: 6,
  fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "16px 0",
  background: "rgba(0,255,135,0.1)",
  border: "1px solid rgba(0,255,135,0.3)",
  color: "#00ff87",
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: 0.5,
  cursor: "pointer",
  borderRadius: 8,
  fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
};
