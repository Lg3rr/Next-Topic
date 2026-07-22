import { pgTable, uuid, text, varchar, doublePrecision, integer, timestamp, pgEnum, json } from "drizzle-orm/pg-core";

export const sessionStatusEnum = pgEnum("session_status", ["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CACHED"]);
export const modelTierEnum = pgEnum("model_tier", ["PRIMARY", "SECONDARY", "CACHE_HIT"]);
export const apiStatusEnum = pgEnum("api_status", ["SUCCESS", "RATE_LIMITED", "QUOTA_EXHAUSTED", "KEY_INVALID", "TIMEOUT", "ERROR", "FALLBACK_USED"]);

export const studySessionsTable = pgTable("study_sessions", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id"),
  subject:    varchar("subject", { length: 255 }).notNull(),
  inputText:  text("input_text").notNull(),
  outputText: text("output_text"),
  score:      doublePrecision("score"),
  status:     sessionStatusEnum("status").notNull().default("QUEUED"),
  cacheKey:   varchar("cache_key", { length: 64 }).unique(),
  modelTier:  modelTierEnum("model_tier"),
  metadata:   json("metadata"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiUsageLogsTable = pgTable("api_usage_logs", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id"),
  sessionId: uuid("session_id").unique(),
  modelName: varchar("model_name", { length: 128 }).notNull(),
  tier:      modelTierEnum("tier").notNull(),
  tokensIn:  integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costMicro: integer("cost_micro").notNull().default(0),
  latencyMs: integer("latency_ms"),
  status:    apiStatusEnum("status").notNull(),
  errorMsg:  text("error_msg"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
