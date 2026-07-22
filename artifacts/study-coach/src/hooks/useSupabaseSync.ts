import { useState, useCallback } from "react";
import type { Session, AnalysisResult } from "../storage";

/**
 * Hook to sync study sessions from localStorage to Supabase
 * 
 * Usage:
 *   const { syncSessions, isSyncing, error } = useSyncToSupabase();
 *   await syncSessions(userId, sessions, analysisResult);
 */
export function useSyncToSupabase() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncSessions = useCallback(
    async (
      userId: string,
      sessions: Session[],
      analysisResult?: AnalysisResult | null
    ) => {
      // Early exit if no data
      if (!userId || sessions.length === 0) {
        setError("userId and sessions are required");
        return { success: false, error: "Missing required data" };
      }

      setIsSyncing(true);
      setError(null);

      try {
        // Determine API endpoint
        const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:3001/api";

        // Transform analysis result to match API schema
        const analysisPayload = analysisResult
          ? {
              status: analysisResult.status,
              level: analysisResult.performance_level || 5,
              status_reason: analysisResult.status_reason,
              patterns: analysisResult.patterns || [],
              callouts: analysisResult.callouts || [],
              weak_subjects: [], // extract from analysisResult if needed
              improvement_points: analysisResult.improvement_points || [],
              one_liner: analysisResult.one_liner,
              tomorrow_plan: analysisResult.next_action_plan || [],
            }
          : undefined;

        // Make API request
        const response = await fetch(`${apiBase}/sessions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            sessions,
            analysisResult: analysisPayload,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || `API returned ${response.status}`;
          setError(errorMessage);
          return { success: false, error: errorMessage };
        }

        const result = await response.json();
        console.log("✅ Sessions synced to Supabase:", result);

        return { success: true, data: result };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error during sync";
        setError(errorMessage);
        console.error("❌ Sync failed:", err);
        return { success: false, error: errorMessage };
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  return { syncSessions, isSyncing, error };
}

/**
 * Hook to fetch sessions from Supabase
 * 
 * Usage:
 *   const { fetchSessions, isFetching, error } = useFetchSessions();
 *   const sessions = await fetchSessions(userId);
 */
export function useFetchSessions() {
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (userId: string) => {
    if (!userId) {
      setError("userId is required");
      return { success: false, sessions: [], error: "Missing userId" };
    }

    setIsFetching(true);
    setError(null);

    try {
      const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:3001/api";
      const response = await fetch(`${apiBase}/sessions/${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `API returned ${response.status}`;
        setError(errorMessage);
        return { success: false, sessions: [], error: errorMessage };
      }

      const result = await response.json();
      console.log("✅ Sessions fetched from Supabase:", result);

      return { success: true, sessions: result.sessions || [] };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error during fetch";
      setError(errorMessage);
      console.error("❌ Fetch failed:", err);
      return { success: false, sessions: [], error: errorMessage };
    } finally {
      setIsFetching(false);
    }
  }, []);

  return { fetchSessions, isFetching, error };
}

/**
 * Hook to delete a session from Supabase
 * 
 * Usage:
 *   const { deleteSession, isDeleting, error } = useDeleteSession();
 *   await deleteSession(sessionId);
 */
export function useDeleteSession() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      setError("sessionId is required");
      return { success: false, error: "Missing sessionId" };
    }

    setIsDeleting(true);
    setError(null);

    try {
      const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:3001/api";
      const response = await fetch(`${apiBase}/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `API returned ${response.status}`;
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      const result = await response.json();
      console.log("✅ Session deleted from Supabase");

      return { success: true, data: result };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error during delete";
      setError(errorMessage);
      console.error("❌ Delete failed:", err);
      return { success: false, error: errorMessage };
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteSession, isDeleting, error };
              }
