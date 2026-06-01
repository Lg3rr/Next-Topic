import { useState } from "react";
import { addSession } from "../storage";

const SUBJECTS = ["Math", "Physics", "Chemistry", "Biology", "History", "Literature", "Programming", "English", "Economics", "Other"];

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: "#666", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            style={{
              flex: 1, padding: "10px 0", border: "1px solid",
              borderColor: value >= n ? "#00ff87" : "rgba(255,255,255,0.08)",
              background: value >= n ? "rgba(0,255,135,0.08)" : "transparent",
              color: value >= n ? "#00ff87" : "#444",
              borderRadius: 4, cursor: "pointer",
              fontSize: 13, fontFamily: "inherit",
            }}
          >
            {n}
          </button>
        ))}
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
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#555", marginBottom: 24 }}>LOG SESSION</div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "#666", marginBottom: 8 }}>SUBJECT</div>
        <select
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          style={selectStyle}
        >
          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "#666", marginBottom: 8 }}>
          DURATION — <span style={{ color: "#00ff87" }}>{form.duration} min</span>
        </div>
        <input
          type="range" min={5} max={300} step={5}
          value={form.duration}
          onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
          style={{ width: "100%", accentColor: "#00ff87" }}
        />
      </div>

      <RatingRow label="DIFFICULTY" value={form.difficulty} onChange={(v) => setForm((f) => ({ ...f, difficulty: v }))} />
      <RatingRow label="FOCUS" value={form.focus} onChange={(v) => setForm((f) => ({ ...f, focus: v }))} />
      <RatingRow label="RETENTION" value={form.retention} onChange={(v) => setForm((f) => ({ ...f, retention: v }))} />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "#666", marginBottom: 8 }}>NOTES</div>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="what went well, what didn't, how you felt..."
          rows={3}
          style={{ ...selectStyle, resize: "vertical" as const, lineHeight: "1.6" }}
        />
      </div>

      <button onClick={handleSubmit} style={primaryBtn}>
        {saved ? "✓ SAVED" : "LOG SESSION"}
      </button>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e0e0e0", fontSize: 12, borderRadius: 4,
  fontFamily: "inherit", boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  width: "100%", padding: 14,
  background: "rgba(0,255,135,0.08)",
  border: "1px solid rgba(0,255,135,0.25)",
  color: "#00ff87", fontSize: 11,
  letterSpacing: 3, cursor: "pointer", borderRadius: 4,
  fontFamily: "inherit",
};
