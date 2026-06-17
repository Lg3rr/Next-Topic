import { pgTable, uuid, varchar, text, timestamp, doublePrecision, integer, pgEnum, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const sessionStatusEnum = pgEnum("session_status", [
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CACHED",
]);

export const modelTierEnum = pgEnum("model_tier", [
  "PRIMARY",
  "SECONDARY",
  "CACHE_HIT",
]);

export const studySessionsTable = pgTable("study_sessions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  subject:     varchar("subject", { length: 255 }).notNull(),
  inputText:   text("input_text").notNull(),
  outputText:  text("output_text"),
  score:       doublePrecision("score"),
  status:      sessionStatusEnum("status").notNull().default("QUEUED"),
  cacheKey:    varchar("cache_key", { length: 64 }).unique(),  // SHA-256(subject + inputText)
  modelTier:   modelTierEnum("model_tier"),
  metadata:    json("metadata"),                               // prompt version, difficulty, A/B flags
  retryCount:  integer("retry_count").notNull().default(0),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStudySessionSchema = createInsertSchema(studySessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStudySession = z.infer<typeof insertStudySessionSchema>;
export type StudySession = typeof studySessionsTable.$inferSelect;

