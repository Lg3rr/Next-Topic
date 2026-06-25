import { useState } from "react";
import { updateSession } from "../storage";
import type { Session } from "../storage";

const font = "'Inter', 'Roboto', system-ui, sans-serif";

type SessionType = "Practice" | "Theory" | "Revision";

interface InterviewAnswers {
  type: SessionType;
  q1: string;
  q2: string;
}

const QUESTIONS: Record<SessionType, { q1: string; q2: string; q1Options?: string[]; q2Options?: string[]; q3?: string;        // Added ? here
  q3Options?: string[] }> = {
 Practice: {
  q1: "Roughly how many questions did you attempt?",
  q2: "How was your accuracy?",
  q2Options: [
    "Mostly Correct (80%+)",
    "Mixed (50% - 80%)",
    "Struggled (<50%)"
  ],
  q3: "What slowed you down the most today?",
  q3Options: [
    "Concept gaps",
    "Calculation mistakes",
    "Careless errors",
    "Speed",
    "Focus",
    "Nothing major"
  ]
},

Theory: {
  q1: "How confident are you about this topic?",
  q1Options: ["1","2","3","4","5","6","7","8","9","10"],
  q2: "What best describes your understanding?",
  q2Options: [
    "Can explain it to someone else",
    "Understand but need practice",
    "Understand parts of it",
    "Still confused"
  ],
  q3: "What is the biggest thing holding you back?",
  q3Options: [
    "Concepts aren't clear",
    "Can't remember details",
    "Need more examples",
    "Need question practice",
    "Nothing major"
  ]
},

Revision: {
  q1: "How much did you remember before revising?",
  q1Options: [
    "Almost everything",
    "Some",
    "Very little"
  ],
  q2: "After revising, how does it feel now?",
  q2Options: [
    "Locked in",
    "Mostly clear",
    "Needs another revision soon"
  ],
  q3: "What still needs work?",
  q3Options: [
    "Memory",
    "Understanding",
    "Question solving",
    "Speed",
    "Nothing major"
  ]
}
};

interface Props {
  session: Session;
  onDone: () => void;
}

export default function InterviewScreen({ session, onDone }: Props) {
  const [step, setStep] = useState<"type" | "questions">("type");
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [error, setError] = useState<string | null>(null);

 function handleSkip() {
  onDone();
}

 function handleSubmit() {
  if (!sessionType) return;

  const q = QUESTIONS[sessionType];

  const parts: string[] = [`Session type: ${sessionType}`];

  parts.push(`${q.q1} → ${q1 || "Skipped"}`);

  if (q.q2) {
    parts.push(`${q.q2} → ${q2 || "Skipped"}`);
  }

  if (q.q3) {
    parts.push(`${q.q3} → ${q3 || "Skipped"}`);
  }

  updateSession({
    ...session,
    sessionType,
    interviewContext: parts.join("\n"),
  });

  onDone();
} 
 


  if (step === "type") {
    return (
      <div style={{ padding: "32px 20px", maxWidth: 480, margin: "0 auto", fontFamily: font }}>
        <div style={{ marginBottom: 6, fontSize: 12, color: "#444" }}>
          {session.subject} · {session.duration}min
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#e0e0e0", marginBottom: 6 }}>
          Quick check-in
        </div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 28, lineHeight: 1.6 }}>
          Two quick questions to make your analysis sharper. Takes 15 seconds.
        </div>

        <div style={{ fontSize: 11, color: "#555", letterSpacing: 0.5, marginBottom: 12, textTransform: "uppercase" }}>
          What kind of session was this?
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          {(["Practice", "Theory", "Revision"] as SessionType[]).map((t) => (
            <button
              key={t}
              onClick={() => { setSessionType(t); setStep("questions"); setQ1(""); setQ2(""); }}
              style={typeBtn}
            >
              <span style={{ fontWeight: 500, color: "#ccc" }}>{t}</span>
              <span style={{ fontSize: 11, color: "#444", marginLeft: 8 }}>
                {t === "Practice" && "Solving problems / mock tests"}
                {t === "Theory" && "Reading / understanding concepts"}
                {t === "Revision" && "Going over material you've covered"}
              </span>
            </button>
          ))}
        </div>

        <button onClick={handleSkip} style={skipBtn}>Skip — just run analysis</button>
      </div>
    );
  }

  // questions step
  const q = sessionType ? QUESTIONS[sessionType] : null;
  if (!q || !sessionType) return null;

  const canSubmit = !!q1 && (!q.q2 || !!q2);

  return (
    <div style={{ padding: "32px 20px", maxWidth: 480, margin: "0 auto", fontFamily: font }}>
      <div style={{ marginBottom: 6, fontSize: 12, color: "#444" }}>
        {session.subject} · {sessionType}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#e0e0e0", marginBottom: 28 }}>
        Quick check-in
      </div>

      {/* Q1 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, color: "#aaa", marginBottom: 12, lineHeight: 1.5 }}>{q.q1}</div>
        {q.q1Options ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {q.q1Options.map((opt) => (
              <button
                key={opt}
                onClick={() => setQ1(opt)}
                style={optionBtn(q1 === opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="number"
            min={1}
            placeholder="e.g. 20"
            value={q1}
            onChange={(e) => setQ1(e.target.value)}
            style={inputStyle}
          />
        )}
      </div>

      {/* Q2 */}
      {q.q2 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: "#aaa", marginBottom: 12, lineHeight: 1.5 }}>{q.q2}</div>
          {q.q2Options ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {q.q2Options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setQ2(opt)}
                  style={optionBtn(q2 === opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={q2}
              onChange={(e) => setQ2(e.target.value)}
              style={inputStyle}
            />
          )}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: "#ff4d6d", marginBottom: 16 }}>{error}</div>
      )}

      <button onClick={handleSubmit} disabled={!canSubmit} style={submitBtn(!canSubmit)}>
        Analyze my session
      </button>
      <button onClick={handleSkip} style={skipBtn}>Skip — just run analysis</button>
    </div>
  );
}

const typeBtn: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 8,
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  fontFamily: font,
};

function optionBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    background: active ? "rgba(0,255,135,0.1)" : "rgba(255,255,255,0.02)",
    border: "1px solid",
    borderColor: active ? "rgba(0,255,135,0.4)" : "rgba(255,255,255,0.08)",
    color: active ? "#00ff87" : "#666",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: font,
    transition: "all 0.1s ease",
  };
}

function submitBtn(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "15px 0",
    background: disabled ? "transparent" : "rgba(0,255,135,0.1)",
    border: "1px solid",
    borderColor: disabled ? "rgba(255,255,255,0.05)" : "rgba(0,255,135,0.3)",
    color: disabled ? "#333" : "#00ff87",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 8,
    marginBottom: 10,
    fontFamily: font,
    letterSpacing: 0.3,
  };
}

const skipBtn: React.CSSProperties = {
  width: "100%",
  padding: "13px 0",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.05)",
  color: "#333",
  fontSize: 13,
  cursor: "pointer",
  borderRadius: 8,
  fontFamily: font,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#e0e0e0",
  fontSize: 14,
  borderRadius: 6,
  fontFamily: font,
  boxSizing: "border-box",
};
