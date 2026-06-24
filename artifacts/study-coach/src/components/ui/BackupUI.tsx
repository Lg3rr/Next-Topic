import { useState, useRef } from "react";
import { localStorageManager } from "../../lib/localStorageManager";

interface BackupUIProps {
  onImportSuccess?: (count: number) => void;
  onImportError?: (errors: string[]) => void;
}

export function BackupUI({ onImportSuccess, onImportError }: BackupUIProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
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
    padding: "16px",
    backgroundColor: "#f9f9f9",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    marginTop: "20px",
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: "flex",
    gap: "12px",
    marginBottom: message ? "12px" : "0",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "10px 16px",
    backgroundColor: "#2196F3",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "background-color 0.2s",
  };

  const messageStyle: React.CSSProperties = {
    padding: "12px",
    borderRadius: "6px",
    fontSize: "13px",
    marginBottom: "0",
    backgroundColor: message?.type === "success" ? "rgba(76,175,80,0.1)" : "rgba(244,67,54,0.1)",
    border: `1px solid ${message?.type === "success" ? "#4CAF50" : "#F44336"}`,
    color: message?.type === "success" ? "#2E7D32" : "#C62828",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: "600",
    color: "#666",
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>Backup & Restore</div>

      <div style={buttonContainerStyle}>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            ...buttonStyle,
            opacity: exporting ? 0.6 : 1,
            cursor: exporting ? "not-allowed" : "pointer",
          }}
        >
          {exporting ? "Exporting..." : "📥 Export Backup"}
        </button>

        <button
          onClick={handleImportClick}
          disabled={importing}
          style={{
            ...buttonStyle,
            backgroundColor: "#4CAF50",
            opacity: importing ? 0.6 : 1,
            cursor: importing ? "not-allowed" : "pointer",
          }}
        >
          {importing ? "Importing..." : "📤 Import Backup"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
      </div>

      {message && <div style={messageStyle}>{message.text}</div>}
    </div>
  );
}
