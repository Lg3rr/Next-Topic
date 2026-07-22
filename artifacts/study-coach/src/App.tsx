import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LogScreen from "./screens/LogScreen";
import HistoryScreen from "./screens/HistoryScreen";
import AnalysisScreen from "./screens/AnalysisScreen";
import InterviewScreen from "./screens/InterviewScreen";
import PomodoroScreen from "./screens/PomodoroScreen";
import FocusLabScreen from "./screens/FocusLabScreen";
import MenuDrawer, { type Tab } from "./components/MenuDrawer";
import { BackupUI } from "./components/ui/BackupUI";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { getSessions } from "./storage";
import type { Session } from "./storage";
import { color, font } from "./theme";

const SCREEN_TITLES: Record<Tab, string> = {
  log: "Study Coach",
  history: "Study Coach",
  analysis: "Analysis",
  pomodoro: "Pomodoro",
  focusLab: "Focus Lab",
  backup: "Backup",
};

export default function App() {
  const [tab, setTab] = useState<Tab>("log");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [interviewSession, setInterviewSession] = useState<Session | null>(null);
  const { isReady, saveSession } = useLocalStorage();

  useEffect(() => {
    const migrate = async () => {
      const oldSessions = getSessions();
      if (oldSessions.length > 0) {
        for (const session of oldSessions) {
          await saveSession(session);
        }
      }
    };
    migrate();
  }, [saveSession]);

  if (!isReady) {
    return (
      <div style={{ minHeight: "100vh", background: color.bgDeep, color: color.textPrimary, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font }}>
        <div>Loading...</div>
      </div>
    );
  }

  function handleSessionSaved(session: Session) {
    setInterviewSession(session);
  }

  function handleInterviewDone() {
    setInterviewSession(null);
    setTab("analysis");
  }

  function handleEdit(session: Session) {
    setEditSession(session);
    setTab("log");
  }

  function handleEditDone() {
    setEditSession(null);
    setTab("history");
  }

  function handleTabChange(t: Tab) {
    if (t !== "log") setEditSession(null);
    setInterviewSession(null);
    setTab(t);
  }

  const showInterview = interviewSession !== null;

  function renderScreen() {
    if (showInterview) return <InterviewScreen session={interviewSession!} onDone={handleInterviewDone} />;
    switch (tab) {
      case "log": return <LogScreen editSession={editSession} onEditDone={handleEditDone} onSessionSaved={handleSessionSaved} />;
      case "history": return <HistoryScreen onEdit={handleEdit} />;
      case "analysis": return <AnalysisScreen />;
      case "pomodoro": return <PomodoroScreen />;
      case "focusLab": return <FocusLabScreen />;
      case "backup": return <div style={{ padding: "24px 20px" }}><BackupUI /></div>;
    }
  }

  const activeKey = showInterview ? "interview" : tab;

  return (
    <div style={{ minHeight: "100vh", background: color.bgDeep, color: color.textPrimary, fontFamily: font }}>
      <div style={{
        padding: "18px 20px 16px",
        borderBottom: `1px solid ${color.border}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        background: color.bgDeep,
        zIndex: 30,
      }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: color.textFaint }}>NEXT TOPIC</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: color.textPrimary, letterSpacing: 1 }}>
            {SCREEN_TITLES[tab].toUpperCase()}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", gap: 5, padding: 8,
          }}
        >
          <span style={{ width: 22, height: 2, background: color.textPrimary, borderRadius: 2 }} />
          <span style={{ width: 22, height: 2, background: color.textPrimary, borderRadius: 2 }} />
          <span style={{ width: 22, height: 2, background: color.textPrimary, borderRadius: 2 }} />
        </motion.button>
      </div>

      <div style={{ paddingBottom: 76, position: "relative" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeKey}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom footer — Log / History, matching the mockup's two-link footer */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        display: "flex", borderTop: `1px solid ${color.border}`,
        background: color.bgPanel,
        zIndex: 20,
      }}>
        {(["log", "history"] as Tab[]).map((t) => {
          const isActive = !showInterview && tab === t;
          return (
            <button key={t} onClick={() => handleTabChange(t)} style={{
              flex: 1, padding: "16px 0",
              background: "transparent",
              border: "none",
              borderTop: "2px solid",
              borderColor: isActive ? color.accentBright : "transparent",
              color: isActive ? color.accentBright : color.textMuted,
              fontSize: 13, fontWeight: 700, letterSpacing: 1,
              cursor: "pointer", fontFamily: font,
              textTransform: "uppercase",
            }}>
              {t === "log" ? "Log Screen" : "History"}
            </button>
          );
        })}
      </div>

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} active={tab} onSelect={handleTabChange} />
    </div>
  );
}
