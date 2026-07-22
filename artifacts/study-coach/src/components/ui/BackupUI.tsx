import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { localStorageManager } from "../../lib/localStorageManager";
import { clearSessions } from "../../storage";
import { color, font } from "../../theme";

interface BackupUIProps {
  onImportSuccess?: (count: number) => void;
  onImportError?: (errors: string[]) => void;
}

export function BackupUI({ onImportSuccess, onImportError }: BackupUIProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);

    try {
      const backup = await localStorageManager.exportBackup();
      const json = JSON.stringify(backup, null, 2);
      const filename = `study-coach-backup-${new Date().toISOString().split("T")[0]}.json`;
      const blob = new Blob([json], { type: "application/json" });

      // Try native Web Share API first (works in Median WebView + mobile browsers)
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], filename, { type: "application/json" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "Study Coach Backup",
              text: `Backup with ${backup.metadata.totalSessions} session(s)`,
            });
            setMessage({
              type: "success",
              text: `✓ Exported ${backup.metadata.totalSessions} session(s)`,
            });
            setExporting(false);
            return;
          } catch (shareErr) {
            // User cancelled share, or share failed — fall through to download
            if (shareErr instanceof Error && shareErr.name === "AbortError") {
              setExporting(false);
              return; // User cancelled, don't show error
            }
          }
        }
      }

      // Fallback: standard browser download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({
        type: "success",
        text: `✓ Exported ${backup.metadata.totalSessions} session(s)`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: `✗ Export failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage(null);

    try {
      const content = await file.text();
      const result = await localStorageManager.importBackup(content);

      if (result.errors.length > 0) {
        onImportError?.(result.errors);
        setMessage({
          type: "error",
          text: `⚠ Imported ${result.imported} session(s), but ${result.errors.length} error(s) occurred`,
        });
      } else {
        onImportSuccess?.(result.imported);
        setMessage({
          type: "success",
          text: `✓ Imported ${result.imported} session(s) successfully`,
        });
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      onImportError?.([errorMsg]);
      setMessage({
        type: "error",
        text: `✗ Import failed: ${errorMsg}`,
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const containerStyle: React.CSSProperties = {
    padding: "20px",
    backgroundColor: color.bgCard,
    border: `1px solid ${color.border}`,
    borderRadius: "10px",
    marginTop: "20px",
    fontFamily: font,
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: "flex",
    gap: "12px",
    marginBottom: message ? "12px" : "0",
    flexWrap: "wrap",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "12px 18px",
    backgroundColor: color.accent,
    color: color.bgDeep,
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.2s ease",
    fontFamily: font,
    flex: "1 1 auto",
    minWidth: "140px",
  };

  const messageStyle: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    marginBottom: "0",
    backgroundColor: message?.type === "success" ? color.accentDim : color.redDim,
    border: `1px solid ${message?.type === "success" ? color.accentBorder : "rgba(248,113,113,0.3)"}`,
    color: message?.type === "success" ? color.accent : color.red,
    fontFamily: font,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: "700",
    color: color.textMuted,
    marginBottom: "14px",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    fontFamily: font,
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure? This will delete ALL sessions. This cannot be undone.")) {
      return;
    }
    setClearing(true);
    try {
      await localStorageManager.clearAll();
      clearSessions();
      setMessage({
        type: "success",
        text: "✓ All sessions cleared",
      });
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setMessage({
        type: "error",
        text: `✗ Clear failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={containerStyle}
    >
      <div style={labelStyle}>Backup & Restore</div>

      <div style={buttonContainerStyle}>
        <motion.button
          onClick={handleExport}
          disabled={exporting}
          whileTap={{ scale: 0.97 }}
          whileHover={{ opacity: 0.9 }}
          style={{
            ...buttonStyle,
            opacity: exporting ? 0.6 : 1,
            cursor: exporting ? "not-allowed" : "pointer",
          }}
        >
          {exporting ? "Exporting..." : "📥 Export"}
        </motion.button>

        <motion.button
          onClick={handleImportClick}
          disabled={importing}
          whileTap={{ scale: 0.97 }}
          whileHover={{ opacity: 0.9 }}
          style={{
            ...buttonStyle,
            backgroundColor: color.accentBright,
            opacity: importing ? 0.6 : 1,
            cursor: importing ? "not-allowed" : "pointer",
          }}
        >
          {importing ? "Importing..." : "📤 Import"}
        </motion.button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          style={messageStyle}
        >
          {message.text}
        </motion.div>
      )}

      <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: `1px solid ${color.border}` }}>
        <div style={labelStyle}>Danger Zone</div>
        <motion.button
          onClick={handleClearAll}
          disabled={clearing}
          whileTap={{ scale: 0.97 }}
          whileHover={{ opacity: 0.9 }}
          style={{
            width: "100%",
            padding: "12px 18px",
            backgroundColor: "rgba(248,113,113,0.1)",
            color: color.red,
            border: `1px solid ${color.red}`,
            borderRadius: "6px",
            cursor: clearing ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "600",
            transition: "all 0.2s ease",
            fontFamily: font,
            opacity: clearing ? 0.6 : 1,
          }}
        >
          {clearing ? "Clearing..." : "🗑️ Clear All Sessions"}
        </motion.button>
      </div>
    </motion.div>
  );
}