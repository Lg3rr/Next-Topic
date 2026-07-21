import { motion, AnimatePresence } from "framer-motion";
import { color, font } from "../theme";

export type Tab = "log" | "history" | "analysis" | "pomodoro" | "focusLab" | "backup";

const ITEMS: { key: Tab; label: string }[] = [
  { key: "pomodoro", label: "POMODORO" },
  { key: "analysis", label: "ANALYSIS" },
  { key: "focusLab", label: "FOCUS LAB" },
  { key: "backup", label: "BACKUP" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  active: Tab;
  onSelect: (t: Tab) => void;
}

export default function MenuDrawer({ open, onClose, active, onSelect }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 40,
              background: "rgba(0,0,0,0.55)",
            }}
          />
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0,
              width: "min(78vw, 320px)",
              background: color.bgPanel,
              borderLeft: `1px solid ${color.border}`,
              zIndex: 50,
              padding: "28px 24px",
              boxShadow: "-20px 0 50px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: color.textPrimary, letterSpacing: 1, marginBottom: 36 }}>
              MENU
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {ITEMS.map((item, i) => (
                <motion.button
                  key={item.key}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04 }}
                  onClick={() => { onSelect(item.key); onClose(); }}
                  style={{
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    color: active === item.key ? color.accentBright : color.textSecondary,
                    cursor: "pointer",
                    fontFamily: font,
                    padding: 0,
                  }}
                >
                  {item.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
