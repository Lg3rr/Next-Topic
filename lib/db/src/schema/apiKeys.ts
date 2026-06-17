import { pgTable, uuid, varchar, integer, timestamp, pgEnum, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const keyStatusEnum = pgEnum("key_status", [
  "ACTIVE",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "INVALID",
  "RETIRED",
]);

export const apiKeysTable = pgTable("api_keys", {
  id:               uuid("id").primaryKey().defaultRandom(),
  keyHash:          varchar("key_hash", { length: 255 }).notNull().unique(),
  label:            varchar("label", { length: 128 }).notNull(),
  provider:         varchar("provider", { length: 64 }).notNull(),   // "google", "openai"
  model:            varchar("model", { length: 128 }).notNull(),     // "gemini-1.5-flash"
  status:           keyStatusEnum("status").notNull().default("ACTIVE"),
  weight:           integer("weight").notNull().default(10),         // higher = more traffic
  dailyLimit:       integer("daily_limit"),
  minuteLimit:      integer("minute_limit"),
  requestsToday:    integer("requests_today").notNull().default(0),
  lastResetAt:      timestamp("last_reset_at", { withTimezone: true }).notNull().defaultNow(),
  lastThrottledAt:  timestamp("last_throttled_at", { withTimezone: true }),
  cooldownUntil:    timestamp("cooldown_until", { withTimezone: true }),
  metadata:         json("metadata"),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeysTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeysTable.$inferSelect;

