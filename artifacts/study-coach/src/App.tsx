import { useState } from "react";
import LogScreen from "./screens/LogScreen";
import HistoryScreen from "./screens/HistoryScreen";
import AnalysisScreen from "./screens/AnalysisScreen";

const TABS = ["log", "history", "analysis"] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>("log");

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e0e0e0", fontFamily: "'Courier New', monospace" }}>
      <div style={{ padding: "20px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: "#444" }}>PERSONAL AI</div>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#fff", letterSpacing: 1, marginBottom: 16 }}>
          STUDY COACH
        </div>
      </div>

      <div style={{ paddingBottom: 60 }}>
        {tab === "log"      && <LogScreen />}
        {tab === "history"  && <HistoryScreen />}
        {tab === "analysis" && <AnalysisScreen />}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        display: "flex", borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "#0a0a0f",
      }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "14px 0",
            background: "transparent",
            border: "none",
            borderTop: "2px solid",
            borderColor: tab === t ? "#00ff87" : "transparent",
            color: tab === t ? "#00ff87" : "#444",
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
