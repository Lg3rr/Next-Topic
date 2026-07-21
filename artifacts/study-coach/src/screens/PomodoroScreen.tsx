import { motion, AnimatePresence } from "framer-motion";
import { usePomodoroTimer } from "../hooks/usePomodoroTimer";
import { color, font } from "../theme";

const SUBJECTS = ["Maths", "Physics", "Chemistry", "Biology", "Revision", "Other"];
const RING_SIZE = 260;
const STROKE = 10;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function PomodoroScreen() {
  const t = usePomodoroTimer();

  const dashOffset = t.kind === "countdown" ? CIRC * (1 - t.progress) : 0;

  return (
    <div style={{ padding: "24px 20px 40px", maxWidth: 480, margin: "0 auto", fontFamily: font }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: RING_SIZE,
            height: RING_SIZE,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #1e2b22, #08120c 70%)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={STROKE}
            />
            <motion.circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={t.mode === "focus" ? color.accent : color.amber}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.4, ease: "linear" }}
            />
          </svg>

          <div style={{ textAlign: "center", zIndex: 1 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${t.mm}:${t.ss}`}
                initial={{ opacity: 0.4 }}
                animate={{ opacity: 1 }}
                style={{ fontSize: 52, fontWeight: 700, color: color.textPrimary, fontVariantNumeric: "tabular-nums" }}
              >
                {t.mm}:{t.ss}
              </motion.div>
            </AnimatePresence>

            <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 18 }}>
              <RoundButton onClick={t.running ? t.pause : t.start} primary>
                {t.running ? "❚❚" : "▶"}
              </RoundButton>
              <RoundButton onClick={() => t.reset()}>
                ↺
              </RoundButton>
            </div>
          </div>

          <div style={{ position: "absolute", bottom: 14, right: 20, fontSize: 11, color: color.textMuted, letterSpacing: 1 }}>
            session {t.sessionNumber}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: color.textMuted, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
            Subject
          </div>
          <select
            value={t.subject}
            onChange={(e) => t.setSubject(e.target.value)}
            style={selectStyle}
          >
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: color.textMuted, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase", textAlign: "center" }}>
            Mode
          </div>
          <div style={modeToggleOuter}>
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              style={{
                position: "absolute",
                top: 3,
                bottom: 3,
                left: t.mode === "focus" ? 3 : "50%",
                width: "calc(50% - 3px)",
                background: t.mode === "focus" ? color.accentDim : color.amberDim,
                border: `1px solid ${t.mode === "focus" ? color.accentBorder : "rgba(250,204,21,0.4)"}`,
                borderRadius: 999,
              }}
            />
            <button onClick={() => t.mode !== "focus" && t.toggleMode()} style={modeBtn(t.mode === "focus")}>
              Focus
            </button>
            <button onClick={() => t.mode !== "break" && t.toggleMode()} style={modeBtn(t.mode === "break")}>
              Break
            </button>
          </div>
        </div>
      </div>

      <button onClick={t.toggleKind} style={kindToggle}>
        {t.kind === "countdown" ? "Switch to stopwatch" : "Switch to countdown"}
      </button>

      {t.kind === "countdown" && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 10, color: color.textMuted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
            Duration — {Math.round(t.durationMs / 60000)} min
          </div>
          <input
            type="range" min={5} max={120} step={5}
            value={Math.round(t.durationMs / 60000)}
            onChange={(e) => t.setDurationMinutes(Number(e.target.value))}
            disabled={t.running}
            style={{ width: "100%", accentColor: color.accent }}
          />
        </div>
      )}

      {t.isFinished === false && t.kind === "countdown" && t.progress === 0 && !t.running && (
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: color.textFaint }}>
          Timer keeps running even if you close the app — it's anchored to the clock, not a tab.
        </div>
      )}
    </div>
  );
}

function RoundButton({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        border: "none",
        background: primary ? color.textPrimary : "rgba(255,255,255,0.08)",
        color: primary ? "#06140c" : color.textPrimary,
        fontSize: 18,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </motion.button>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "rgba(0,0,0,0.4)",
  border: `1px solid ${color.border}`,
  borderRadius: 10,
  color: color.textPrimary,
  fontSize: 14,
  fontFamily: font,
  boxSizing: "border-box",
};

const modeToggleOuter: React.CSSProperties = {
  position: "relative",
  display: "flex",
  width: 168,
  height: 44,
  background: "rgba(0,0,0,0.4)",
  border: `1px solid ${color.border}`,
  borderRadius: 999,
  padding: 0,
};

function modeBtn(active: boolean): React.CSSProperties {
  return {
    position: "relative",
    zIndex: 1,
    flex: 1,
    border: "none",
    background: "transparent",
    color: active ? color.textPrimary : color.textMuted,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: font,
  };
}

const kindToggle: React.CSSProperties = {
  width: "100%",
  marginTop: 18,
  padding: "10px 0",
  background: "transparent",
  border: `1px solid ${color.border}`,
  borderRadius: 10,
  color: color.textMuted,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: font,
};
