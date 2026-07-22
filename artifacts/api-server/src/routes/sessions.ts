import { Router, type IRouter, type Request, type Response } from "express";
import { db, studySessionsTable, apiUsageLogsTable, type InsertStudySession, type InsertApiUsageLog } from "@workspace/db";
import { createHash } from "crypto";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────
interface SessionPayload {
  id: string;
  date: string;
  subject: string;
  duration: number;
  difficulty: number;
  focus: number;
  retention: number;
  notes: string;
}

interface SaveSessionsRequest extends Request {
  body: {
    userId: string;
    sessions: SessionPayload[];
    analysisResult?: {
      status: string;
      performance_level: number;
      status_reason: string;
      patterns: string[];
      callouts: string[];
      weak_subjects: string[];
      improvement_points: string[];
      one_liner: string;
      next_action_plan: Array<{
        subject: string;
        task: string;
        reason: string;
      }>;
    };
  };
}

// ─── Helper: Generate cache key ────────────────────────────────────────────────
function generateCacheKey(subject: string, inputText: string): string {
  return createHash("sha256").update(`${subject}${inputText}`).digest("hex");
}

// ─── POST /sessions ───────────────────────────────────────────────────────────
// Saves study sessions and analysis to Supabase
router.post("/sessions", async (req: SaveSessionsRequest, res: Response): Promise<void> => {
  try {
    const { userId, sessions, analysisResult } = req.body;

    // Validate input
    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "userId is required and must be a string" });
      return;
    }

    if (!Array.isArray(sessions) || sessions.length === 0) {
      res.status(400).json({ error: "sessions must be a non-empty array" });
      return;
    }

    // Transform frontend sessions to DB insert format
    const dbSessions: InsertStudySession[] = sessions.map((session) => {
      const cacheKey = generateCacheKey(session.subject, session.notes || "");
      
      return {
        userId,
        subject: session.subject,
        inputText: session.notes || "",
        status: "COMPLETED",
        cacheKey,
        metadata: {
          difficulty: session.difficulty,
          focus: session.focus,
          retention: session.retention,
          duration: session.duration,
          date: session.date,
          originalId: session.id, // track frontend ID for reference
        } as unknown as JSON,
        score: analysisResult?.performance_level ? analysisResult.performance_level / 10 : undefined,
        modelTier: "CACHE_HIT", // these are local analyses, not API calls
      } as InsertStudySession;
    });

    req.log.info({ userId, count: dbSessions.length }, "Saving sessions to Supabase");

    // Batch insert sessions
    const insertedSessions = await db
      .insert(studySessionsTable)
      .values(dbSessions)
      .returning();

    req.log.info({ userId, inserted: insertedSessions.length }, "Sessions saved successfully");

    // If analysis result provided, log API usage (credit tracking)
    if (analysisResult && analysisResult.performance_level) {
      const apiLog: InsertApiUsageLog = {
        userId,
        sessionId: insertedSessions[0]?.id, // associate with first session
        modelName: "gemini-analysis-local", // local analysis, not external API
        tier: "CACHE_HIT",
        tokensIn: 0,
        tokensOut: 0,
        costMicro: 0, // local analysis, no cost
        latencyMs: undefined,
        status: "SUCCESS",
        errorMsg: null,
      };

      await db.insert(apiUsageLogsTable).values(apiLog);
      req.log.info({ userId }, "API usage logged");
    }

    res.json({
      success: true,
      message: `Saved ${insertedSessions.length} session(s)`,
      sessionIds: insertedSessions.map((s) => s.id),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Error saving sessions");
    res.status(500).json({ error: `Failed to save sessions: ${msg}` });
  }
});

// ─── GET /sessions ────────────────────────────────────────────────────────────
// Retrieve sessions for a user (for sync/hydration)
router.get("/sessions/:userId", async (req, res): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    req.log.info({ userId }, "Fetching sessions");

    const sessions = await db.query.studySessionsTable.findMany({
      where: (table) => sql`${table.userId} = ${userId}`,
      orderBy: (table) => sql`${table.createdAt} DESC`,
      limit: 500,
    });

    res.json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Error fetching sessions");
    res.status(500).json({ error: `Failed to fetch sessions: ${msg}` });
  }
});

// ─── DELETE /sessions/:sessionId ───────────────────────────────────────────────
// Delete a single session
router.delete("/sessions/:sessionId", async (req, res): Promise<void> => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    req.log.info({ sessionId }, "Deleting session");

    const result = await db
      .delete(studySessionsTable)
      .where(sql`id = ${sessionId}`)
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json({ success: true, message: "Session deleted" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Error deleting session");
    res.status(500).json({ error: `Failed to delete session: ${msg}` });
  }
});

export default router;
