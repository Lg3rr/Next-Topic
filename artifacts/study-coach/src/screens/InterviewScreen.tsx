import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { updateSession } from "../storage";
import type { Session } from "../storage";
import { color, font } from "../theme";

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
  const [hoveredType, setHoveredType] = useState<SessionType | null>(null);
  const [hoveredQ1, setHoveredQ1] = useState<string | null>(null);
  const [hoveredQ2, setHoveredQ2] = useState<string | null>(null);
  const [hoveredQ3, setHoveredQ3] = useState<string | null>(null);

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

  function handleTypeSelect(t: SessionType) {
    setSessionType(t);
    setStep("questions");
    setQ1("");
    setQ2("");
    setQ3("");
  }
 


  if (step === "type") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        style={{ padding: "32px 20px", maxWidth: 480, margin: "0 auto", fontFamily: font }}
      >
        <div style={{ marginBottom: 6, fontSize: 12, color: color.textMuted }}>
          {session.subject} · {session.duration}min
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: color.textPrimary, marginBottom: 6 }}>
          Quick check-in
        </div>
        <div style={{ fontSize: 13, color: color.textSecondary, marginBottom: 28, lineHeight: 1.6 }}>
          Three quick questions to make your analysis sharper. Takes 30 seconds.
        </div>

        <div style={{ fontSize: 11, color: color.textMuted, letterSpacing: 0.5, marginBottom: 12, textTransform: "uppercase" }}>
          What kind of session was this?
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          {(["Practice", "Theory", "Revision"] as SessionType[]).map((t, idx) => (
            <motion.button
              key={t}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
              onClick={() => handleTypeSelect(t)}
              onMouseEnter={() => setHoveredType(t)}
              onMouseLeave={() => setHoveredType(null)}
              whileTap={{ scale: 0.97 }}
              style={{
                ...typeBtn,
                background: hoveredType === t ? color.accentDim : "rgba(255,255,255,0.02)",
                borderColor: hoveredType === t ? color.accentBorder : "rgba(255,255,255,0.07)",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontWeight: 500, color: color.textPrimary }}>{t}</span>
              <span style={{ fontSize: 11, color: color.textMuted, marginLeft: 8 }}>
                {t === "Practice" && "Solving problems / mock tests"}
                {t === "Theory" && "Reading / understanding concepts"}
                {t === "Revision" && "Going over material you've covered"}
              </span>
            </motion.button>
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSkip}
          style={skipBtn}
        >
          Skip — just run analysis
        </motion.button>
      </motion.div>
    );
  }

  // questions step
  const q = sessionType ? QUESTIONS[sessionType] : null;
  if (!q || !sessionType) return null;

  const canSubmit = !!q1 && (!q.q2 || !!q2) && (!q.q3 || !!q3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      style={{ padding: "32px 20px", maxWidth: 480, margin: "0 auto", fontFamily: font }}
    >
      <div style={{ marginBottom: 6, fontSize: 12, color: color.textMuted }}>
        {session.subject} · {sessionType}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: color.textPrimary, marginBottom: 28 }}>
        Quick check-in
      </div>

      {/* Q1 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        style={{ marginBottom: 28 }}
      >
        <div style={{ fontSize: 13, color: color.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>{q.q1}</div>
        {q.q1Options ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {q.q1Options.map((opt, idx) => (
              <motion.button
                key={opt}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15, delay: idx * 0.02 }}
                onClick={() => setQ1(opt)}
                onMouseEnter={() => setHoveredQ1(opt)}
                onMouseLeave={() => setHoveredQ1(null)}
                whileTap={{ scale: 0.95 }}
                style={optionBtn(q1 === opt, hoveredQ1 === opt)}
              >
                {opt}
              </motion.button>
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
      </motion.div>

      {/* Q2 */}
      <AnimatePresence>
        {q.q2 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            style={{ marginBottom: 28 }}
          >
            <div style={{ fontSize: 13, color: color.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>{q.q2}</div>
            {q.q2Options ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {q.q2Options.map((opt, idx) => (
                  <motion.button
                    key={opt}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    onClick={() => setQ2(opt)}
                    onMouseEnter={() => setHoveredQ2(opt)}
                    onMouseLeave={() => setHoveredQ2(null)}
                    whileTap={{ scale: 0.95 }}
                    style={optionBtn(q2 === opt, hoveredQ2 === opt)}
                  >
                    {opt}
                  </motion.button>
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Q3 */}
      <AnimatePresence>
        {q.q3 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, delay: 0.15 }}
            style={{ marginBottom: 28 }}
          >
            <div style={{ fontSize: 13, color: color.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>{q.q3}</div>
            {q.q3Options ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {q.q3Options.map((opt, idx) => (
                  <motion.button
                    key={opt}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    onClick={() => setQ3(opt)}
                    onMouseEnter={() => setHoveredQ3(opt)}
                    onMouseLeave={() => setHoveredQ3(null)}
                    whileTap={{ scale: 0.95 }}
                    style={optionBtn(q3 === opt, hoveredQ3 === opt)}
                  >
                    {opt}
                  </motion.button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={q3}
                onChange={(e) => setQ3(e.target.value)}
                style={inputStyle}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ fontSize: 12, color: color.red, marginBottom: 16 }}
        >
          {error}
        </motion.div>
      )}

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={submitBtn(!canSubmit)}
      >
        Analyze my session
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSkip}
        style={skipBtn}
      >
        Skip — just run analysis
      </motion.button>
    </motion.div>
  );
}

const typeBtn: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  background: color.bgCard,
  border: `1px solid ${color.border}`,
  borderRadius: 8,
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  fontFamily: font,
  transition: "all 0.15s ease",
};

function optionBtn(active: boolean, hovered: boolean = false): React.CSSProperties {
  return {
    padding: "8px 16px",
    background: active ? color.accentDim : hovered ? "rgba(255,255,255,0.04)" : color.bgCard,
    border: "1px solid",
    borderColor: active ? color.accentBorder : hovered ? color.border : color.border,
    color: active ? color.accent : color.textSecondary,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: font,
    transition: "all 0.15s ease",
  };
}

function submitBtn(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "15px 0",
    background: disabled ? "transparent" : color.accentDim,
    border: "1px solid",
    borderColor: disabled ? color.border : color.accentBorder,
    color: disabled ? color.textMuted : color.accent,
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 8,
    marginBottom: 10,
    fontFamily: font,
    letterSpacing: 0.3,
    transition: "all 0.15s ease",
  };
}

const skipBtn: React.CSSProperties = {
  width: "100%",
  padding: "13px 0",
  background: "transparent",
  border: `1px solid ${color.border}`,
  color: color.textMuted,
  fontSize: 13,
  cursor: "pointer",
  borderRadius: 8,
  fontFamily: font,
  transition: "all 0.15s ease",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: color.bgInput,
  border: `1px solid ${color.border}`,
  color: color.textPrimary,
  fontSize: 14,
  borderRadius: 6,
  fontFamily: font,
  boxSizing: "border-box",
  transition: "all 0.15s ease",
};
