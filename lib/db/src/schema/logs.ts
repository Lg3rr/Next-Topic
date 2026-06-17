import { pgTable, uuid, varchar, integer, timestamp, pgEnum, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { studySessionsTable } from "./studySessions";
import { apiKeysTable } from "./apiKeys";
import { modelTierEnum } from "./studySessions";

export const apiStatusEnum = pgEnum("api_status", [
  "SUCCESS",
  "RATE_LIMITED",
  "QUOTA_EXHAUSTED",
  "KEY_INVALID",
  "TIMEOUT",
  "ERROR",
  "FALLBACK_USED",
]);

// ─── API Usage Log ────────────────────────────────────────────────────────────
// Append-only ledger. One row per AI API call attempt.
// costMicro: stored as integer microdollars to avoid float precision issues.
// Read as: costMicro / 1_000_000 = USD

export const apiUsageLogsTable = pgTable("api_usage_logs", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId:  uuid("session_id").unique().references(() => studySessionsTable.id),
  apiKeyId:   uuid("api_key_id").references(() => apiKeysTable.id),
  modelName:  varchar("model_name", { length: 128 }).notNull(),
  tier:       modelTierEnum("tier").notNull(),
  tokensIn:   integer("tokens_in").notNull().default(0),
  tokensOut:  integer("tokens_out").notNull().default(0),
  costMicro:  integer("cost_micro").notNull().default(0),
  latencyMs:  integer("latency_ms"),
  status:     apiStatusEnum("status").notNull(),
  errorMsg:   text("error_msg"),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertApiUsageLogSchema = createInsertSchema(apiUsageLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertApiUsageLog = z.infer<typeof insertApiUsageLogSchema>;
export type ApiUsageLog = typeof apiUsageLogsTable.$inferSelect;

// ─── Rate Limit State ─────────────────────────────────────────────────────────
// One row per (user, windowType, windowStart). Upserted on every request.
// windowType: "minute" | "hour" | "day"

export const rateLimitStatesTable = pgTable("rate_limit_states", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  windowType:      varchar("window_type", { length: 16 }).notNull(),
  windowStart:     timestamp("window_start", { withTimezone: true }).notNull(),
  requestCount:    integer("request_count").notNull().default(0),
  tokensConsumed:  integer("tokens_consumed").notNull().default(0),
  blockedCount:    integer("blocked_count").notNull().default(0),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Upsert target: enforce one row per user+window combination
  uniqUserWindow: unique().on(table.userId, table.windowType, table.windowStart),
}));

export const insertRateLimitStateSchema = createInsertSchema(rateLimitStatesTable).omit({
  id: true,
});

export type InsertRateLimitState = z.infer<typeof insertRateLimitStateSchema>;
export type RateLimitState = typeof rateLimitStatesTable.$inferSelect;

