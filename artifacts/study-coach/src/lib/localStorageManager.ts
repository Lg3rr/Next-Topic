/**
 * Local-First Storage Manager
 * 
 * Uses IndexedDB for reliable persistent storage + auto-save
 * Supports export/import of JSON backups
 * No cloud sync, no auth required
 */

import type { Session, AnalysisResult } from "../storage";

export interface BackupFile {
  version: string;
  exportedAt: string;
  sessions: Session[];
  analysisResults: AnalysisResult[];
  metadata: {
    totalSessions: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
  };
}

const DB_NAME = "StudyCoachDB";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const ANALYSIS_STORE = "analysisResults";

class LocalStorageManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase>;

  constructor() {
    this.initPromise = this.initDB();
  }

  /**
   * Initialize IndexedDB
   */
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open IndexedDB");
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create sessions store
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
          sessionsStore.createIndex("date", "date", { unique: false });
          sessionsStore.createIndex("subject", "subject", { unique: false });
        }

        // Create analysis results store
        if (!db.objectStoreNames.contains(ANALYSIS_STORE)) {
          db.createObjectStore(ANALYSIS_STORE, { keyPath: "id" });
        }
      };
    });
  }

  /**
   * Ensure DB is initialized before operations
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = await this.initPromise;
    }
    return this.db;
  }

  /**
   * Save session to IndexedDB
   */
  async saveSession(session: Session): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readwrite");
      const store = tx.objectStore(SESSIONS_STORE);
      const request = store.put(session);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Save multiple sessions (batch)
   */
  async saveSessions(sessions: Session[]): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readwrite");
      const store = tx.objectStore(SESSIONS_STORE);

      sessions.forEach((session) => {
        store.put(session);
      });

      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
    });
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<Session[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readonly");
      const store = tx.objectStore(SESSIONS_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  /**
   * Get session by ID
   */
  async getSession(id: string): Promise<Session | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readonly");
      const store = tx.objectStore(SESSIONS_STORE);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Delete session by ID
   */
  async deleteSession(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readwrite");
      const store = tx.objectStore(SESSIONS_STORE);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Save analysis result
   */
  async saveAnalysisResult(result: AnalysisResult): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ANALYSIS_STORE, "readwrite");
      const store = tx.objectStore(ANALYSIS_STORE);
      const request = store.put({
        id: `analysis-${Date.now()}`,
        ...result,
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get latest analysis result
   */
  async getLatestAnalysis(): Promise<AnalysisResult | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ANALYSIS_STORE, "readonly");
      const store = tx.objectStore(ANALYSIS_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = request.result || [];
        if (results.length === 0) {
          resolve(undefined);
        } else {
          resolve(results[results.length - 1] as AnalysisResult);
        }
      };
    });
  }

  /**
   * Export all data as JSON backup
   */
  async exportBackup(): Promise<BackupFile> {
    const sessions = await this.getAllSessions();
    const analysisResults = await this.getLatestAnalysis();

    const dates = sessions.map((s) => new Date(s.date).getTime()).filter((d) => !isNaN(d));
    const earliest = dates.length > 0 ? new Date(Math.min(...dates)).toISOString().split("T")[0] : null;
    const latest = dates.length > 0 ? new Date(Math.max(...dates)).toISOString().split("T")[0] : null;

    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      sessions,
      analysisResults: analysisResults ? [analysisResults] : [],
      metadata: {
        totalSessions: sessions.length,
        dateRange: {
          earliest: earliest || "N/A",
          latest: latest || "N/A",
        },
      },
    };
  }

  /**
   * Import backup from JSON file
   */
  async importBackup(fileContent: string): Promise<{ imported: number; errors: string[] }> {
    try {
      const backup: BackupFile = JSON.parse(fileContent);
      const errors: string[] = [];

      // Validate version
      if (backup.version !== "1.0") {
        errors.push(`Unsupported backup version: ${backup.version}`);
        return { imported: 0, errors };
      }

      // Import sessions
      if (backup.sessions && Array.isArray(backup.sessions)) {
        try {
          await this.saveSessions(backup.sessions);
        } catch (err) {
          errors.push(`Failed to import sessions: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Import analysis results
      if (backup.analysisResults && Array.isArray(backup.analysisResults)) {
        for (const result of backup.analysisResults) {
          try {
            await this.saveAnalysisResult(result);
          } catch (err) {
            errors.push(`Failed to import analysis result: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      return {
        imported: backup.sessions?.length || 0,
        errors,
      };
    } catch (err) {
      return {
        imported: 0,
        errors: [`Failed to parse backup file: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }

  /**
   * Clear all data (destructive)
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE, ANALYSIS_STORE], "readwrite");

      tx.objectStore(SESSIONS_STORE).clear();
      tx.objectStore(ANALYSIS_STORE).clear();

      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
    });
  }

  /**
   * Get storage stats
   */
  async getStats(): Promise<{ sessionCount: number; lastModified: string | null }> {
    const sessions = await this.getAllSessions();
    const dates = sessions.map((s) => new Date(s.date).getTime()).filter((d) => !isNaN(d));
    const lastModified = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;

    return {
      sessionCount: sessions.length,
      lastModified,
    };
  }
}

// Export singleton instance
export const localStorageManager = new LocalStorageManager();
