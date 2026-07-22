import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from "recharts";
import { getSessions } from "../storage";
import { computeFocusLabStats, setWeeklyGoalHours, getWeeklyGoalHours } from "../focusLabStats";
import { color, font, card } from "../theme";

const SUBJECT_COLORS = [color.amber, color.accent, color.blue, "#a78bfa", "#f472b6", "#fb923c"];

export default function FocusLabScreen() {
  const [goal, setGoal] = useState(getWeeklyGoalHours());
  const [editingGoal, setEditingGoal] = useState(false);

  const stats = useMemo(() => {
    const sessions = getSessions();
    return computeFocusLabStats(sessions);
  }, [goal]);

  function commitGoal(v: number) {
    if (v > 0) {
      setWeeklyGoalHours(v);
      setGoal(v);
    }
    setEditingGoal(false);
  }

  if (stats.totalSessions === 0) {
    return (
      <div style={{ padding: "48px 20px", textAlign: "center", fontFamily: font }}>
        <div style={{ fontSize: 15, color: color.textSecondary, marginBottom: 6 }}>No focus data yet</div>
        <div style={{ fontSize: 13, color: color.textMuted }}>Log a session to start building your stats</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 20px 40px", maxWidth: 480, margin: "0 auto", fontFamily: font }}>
      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: `linear-gradient(145deg, ${color.accentDim}, rgba(34,197,94,0.04))`,
          border: `1px solid ${color.accentBorder}`,
          borderRadius: 18,
          padding: 20,
          boxShadow: "0 0 40px rgba(34,197,94,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <RingPct pct={Math.min(stats.weeklyGoalPct, 100)} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: color.accentBright, letterSpacing: 1, textTransform: "uppercase" }}>
              Total Focus Time
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: color.textPrimary, lineHeight: 1.1 }}>
              {stats.totalHours.toFixed(1)}<span style={{ fontSize: 16, fontWeight: 500 }}> hrs</span>
            </div>
            <div style={{ fontSize: 11, color: color.textSecondary, marginTop: 2 }}>
              {stats.totalSessions} sessions logged
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, height: 36 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.dayOfWeekHours} barCategoryGap="22%">
              <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
                {stats.dayOfWeekHours.map((d, i) => (
                  <Cell key={d.day} fill={i === stats.dayOfWeekHours.length - 1 ? color.accentBright : "rgba(255,255,255,0.18)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: -4 }}>
          {stats.dayOfWeekHours.map((d) => (
            <span key={d.day} style={{ fontSize: 9, color: color.textMuted, flex: 1, textAlign: "center" }}>{d.day[0]}</span>
          ))}
        </div>
      </motion.div>

      {/* Quick stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <StatTile label="Difficulty" value={stats.avgDifficulty.toFixed(1)} suffix="/5" tone={color.amber} />
        <StatTile label="Avg Focus" value={stats.avgFocus.toFixed(1)} suffix="/5" tone="#a78bfa" />
        <StatTile label="Avg Retention" value={stats.avgRetention.toFixed(1)} suffix="/5" tone={color.blue} />
        <StatTile label="Avg Session" value={String(Math.round(stats.avgSessionMin))} suffix="min" tone={color.accent} />
      </div>

      {/* Subject breakdown */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: color.textSecondary, marginBottom: 14, letterSpacing: 0.5 }}>
          SUBJECT BREAKDOWN
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {stats.subjectBreakdown.map((s, i) => (
            <div key={s.subject}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: color.textPrimary }}>{s.subject}</span>
                <span style={{ color: color.textMuted }}>{s.hours.toFixed(1)} hrs · {s.pctOfTotal}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.pctOfTotal}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
                  style={{ height: "100%", background: SUBJECT_COLORS[i % SUBJECT_COLORS.length], borderRadius: 4 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coach's mirror */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: color.textSecondary, marginBottom: 14, letterSpacing: 0.5 }}>
          COACH'S MIRROR
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {stats.strength && (
            <InsightRow icon="★" tone={color.accent} label="Strength" text={stats.strength} />
          )}
          {stats.opportunity && (
            <InsightRow icon="⚡" tone={color.amber} label="Opportunity" text={stats.opportunity} />
          )}
          {!stats.strength && !stats.opportunity && (
            <div style={{ fontSize: 12, color: color.textMuted }}>
              Log a few more sessions per subject to unlock pattern insights.
            </div>
          )}
        </div>
      </div>

      {stats.tip && (
        <div style={{ ...card, marginTop: 14, borderColor: color.accentBorder, background: color.accentDim }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: color.accentBright, marginBottom: 6, letterSpacing: 0.5 }}>
            COACH'S TIP
          </div>
          <div style={{ fontSize: 13, color: color.textPrimary, lineHeight: 1.6 }}>{stats.tip}</div>
        </div>
      )}

      {/* Goal editor */}
      <div style={{ marginTop: 20, textAlign: "center" }}>
        {editingGoal ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
            <input
              type="number"
              autoFocus
              defaultValue={goal}
              min={1}
              onBlur={(e) => commitGoal(Number(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && commitGoal(Number((e.target as HTMLInputElement).value))}
              style={{
                width: 70, padding: "8px 10px", background: color.bgInput,
                border: `1px solid ${color.border}`, borderRadius: 8, color: color.textPrimary,
                fontSize: 13, textAlign: "center", fontFamily: font,
              }}
            />
            <span style={{ fontSize: 12, color: color.textMuted }}>hrs / week</span>
          </div>
        ) : (
          <button onClick={() => setEditingGoal(true)} style={{
            background: "transparent", border: "none", color: color.textFaint,
            fontSize: 11, cursor: "pointer", fontFamily: font, textDecoration: "underline",
          }}>
            Edit weekly goal ({goal}h)
          </button>
        )}
      </div>
    </div>
  );
}

function RingPct({ pct }: { pct: number }) {
  const size = 64;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color.accentBright} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct / 100) }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: color.textPrimary }}>{pct}%</span>
        <span style={{ fontSize: 7, color: color.textMuted, letterSpacing: 0.3 }}>WEEKLY</span>
      </div>
    </div>
  );
}

function StatTile({ label, value, suffix, tone }: { label: string; value: string; suffix: string; tone: string }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ fontSize: 10, color: color.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone }}>
        {value}<span style={{ fontSize: 12, color: color.textMuted, fontWeight: 500 }}>{suffix}</span>
      </div>
    </div>
  );
}

function InsightRow({ icon, tone, label, text }: { icon: string; tone: string; label: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        background: tone + "22", border: `1px solid ${tone}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: tone, fontSize: 13,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: tone, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 12.5, color: color.textSecondary, lineHeight: 1.6 }}>{text}</div>
      </div>
    </div>
  );
}
