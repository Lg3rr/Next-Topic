import { useState, useEffect, useCallback } from "react";
import { localStorageManager, type BackupFile } from "../lib/localStorageManager";
import type { Session, AnalysisResult } from "../storage";

/**
 * Hook to manage local-first storage
 * Auto-saves sessions and analysis results to IndexedDB
 */
export function useLocalStorage() {
  const [isReady, setIsReady] = useState(false);
  const [stats, setStats] = useState({ sessionCount: 0, lastModified: null as string | null });

  // Initialize IndexedDB on mount
  useEffect(() => {
    localStorageManager.getStats().then((s) => {
      setStats(s);
      setIsReady(true);
    });
  }, []);

  /**
   * Auto-save session to IndexedDB
   */
  const saveSession = useCallback(async (session: Session) => {
    try {
      await localStorageManager.saveSession(session);
      const newStats = await localStorageManager.getStats();
      setStats(newStats);
      console.log("✅ Session saved to local storage");
    } catch (err) {
      console.error("❌ Failed to save session:", err);
    }
  }, []);

  /**
   * Auto-save analysis result
   */
  const saveAnalysis = useCallback(async (result: AnalysisResult) => {
    try {
      await localStorageManager.saveAnalysisResult(result);
      console.log("✅ Analysis saved to local storage");
    } catch (err) {
      console.error("❌ Failed to save analysis:", err);
    }
  }, []);

  /**
   * Get all sessions from IndexedDB
   */
  const getAllSessions = useCallback(async (): Promise<Session[]> => {
    try {
      return await localStorageManager.getAllSessions();
    } catch (err) {
      console.error("❌ Failed to fetch sessions:", err);
      return [];
    }
  }, []);

  /**
   * Delete session from IndexedDB
   */
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await localStorageManager.deleteSession(sessionId);
      const newStats = await localStorageManager.getStats();
      setStats(newStats);
      console.log("✅ Session deleted from local storage");
    } catch (err) {
      console.error("❌ Failed to delete session:", err);
    }
  }, []);

  /**
   * Export backup
   */
  const exportBackup = useCallback(async (): Promise<BackupFile | null> => {
    try {
      return await localStorageManager.exportBackup();
    } catch (err) {
      console.error("❌ Failed to export backup:", err);
      return null;
    }
  }, []);

  /**
   * Import backup
   */
  const importBackup = useCallback(async (fileContent: string) => {
    try {
      const result = await localStorageManager.importBackup(fileContent);
      const newStats = await localStorageManager.getStats();
      setStats(newStats);
      return result;
    } catch (err) {
      console.error("❌ Failed to import backup:", err);
      return { imported: 0, errors: [String(err)] };
    }
  }, []);

  /**
   * Clear all data (destructive)
   */
  const clearAll = useCallback(async () => {
    try {
      if (window.confirm("⚠️ This will delete ALL sessions and analysis results. Are you sure?")) {
        await localStorageManager.clearAll();
        setStats({ sessionCount: 0, lastModified: null });
        console.log("✅ All data cleared");
      }
    } catch (err) {
      console.error("❌ Failed to clear data:", err);
    }
  }, []);

  return {
    isReady,
    stats,
    saveSession,
    saveAnalysis,
    getAllSessions,
    deleteSession,
    exportBackup,
    importBackup,
    clearAll,
  };
}
