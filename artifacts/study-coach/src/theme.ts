// Shared design tokens for the Study Coach app.
// Pulled from the green/black mockup — single source of truth so screens
// don't each hardcode their own hex codes and drift apart.

export const color = {
  bgDeep: "#06140c",        // page background (deepest)
  bgPanel: "#0d2417",       // header / menu drawer background
  bgCard: "#13301d",        // card surface
  bgCardAlt: "#15351f",     // slightly lighter card variant
  bgInput: "#0a1a10",       // input / pill background (near-black)
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  accent: "#22c55e",        // primary green accent
  accentBright: "#4ade80",
  accentDim: "rgba(34,197,94,0.14)",
  accentBorder: "rgba(34,197,94,0.35)",
  amber: "#facc15",
  amberDim: "rgba(250,204,21,0.12)",
  red: "#f87171",
  redDim: "rgba(248,113,113,0.12)",
  blue: "#60a5fa",
  textPrimary: "#f1fdf6",
  textSecondary: "#9fb8a8",
  textMuted: "#5c7268",
  textFaint: "#3a4a42",
} as const;

export const font = "'Inter', 'Roboto', system-ui, sans-serif";
export const fontDisplay = "'Archivo Black', 'Inter', system-ui, sans-serif";

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

export const layout = {
  maxWidth: 480,
  pagePad: "20px",
};

// Reusable inline style fragments -------------------------------------------------

export const card: React.CSSProperties = {
  background: color.bgCard,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  padding: 18,
};

export const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: color.textMuted,
  letterSpacing: 1.2,
  textTransform: "uppercase",
};

export const pillInput: React.CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  background: color.bgInput,
  border: `1px solid ${color.border}`,
  borderRadius: radius.pill,
  color: color.textPrimary,
  fontSize: 14,
  fontFamily: font,
  boxSizing: "border-box",
};

export const primaryButton: React.CSSProperties = {
  width: "100%",
  padding: "16px 0",
  background: color.accent,
  border: "none",
  borderRadius: radius.pill,
  color: "#06140c",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: 0.4,
  cursor: "pointer",
  fontFamily: font,
};
