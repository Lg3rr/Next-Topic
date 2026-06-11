import { useState } from "react";
import LogScreen from "./screens/LogScreen";
import HistoryScreen from "./screens/HistoryScreen";
import AnalysisScreen from "./screens/AnalysisScreen";
import InterviewScreen from "./screens/InterviewScreen";
import type { Session } from "./storage";

const TABS = ["log", "history", "analysis"] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>("log");
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [interviewSession, setInterviewSession] = useState<Session | null>(null);

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

  return (
    <div style={{ minHeight: "100vh", background: "#061613", color: "#ECFDF5", fontFamily: "'Courier New', monospace" }}>
      <div style={{ padding: "20px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: "#444" }}>NEXT TOPIC</div>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#fff", letterSpacing: 1, marginBottom: 16 }}>
          STUDY COACH
        </div>
      </div>

      <div style={{ paddingBottom: 60 }}>
        {showInterview
          ? <InterviewScreen session={interviewSession} onDone={handleInterviewDone} />
          : tab === "log"      ? <LogScreen editSession={editSession} onEditDone={handleEditDone} onSessionSaved={handleSessionSaved} />
          : tab === "history"  ? <HistoryScreen onEdit={handleEdit} />
          : <AnalysisScreen />
        }
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        display: "flex", borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "#0a0a0f",
      }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => handleTabChange(t)} style={{
            flex: 1, padding: "14px 0",
            background: "transparent",
            border: "none",
            borderTop: "2px solid",
            borderColor: (!showInterview && tab === t) ? "#00ff87" : "transparent",
            color: (!showInterview && tab === t) ? "#00ff87" : "#444",
            fontSize: 9, letterSpacing: 3,
            cursor: "pointer", fontFamily: "inherit",
            textTransform: "uppercase",
          }}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
