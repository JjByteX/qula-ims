import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

// Generic append-only log. target_type + target_id keep this table usable
// for every entity (user, budget, expense, project, document) without a
// join table per entity — matches phases-plan 4.1 exactly and avoids
// speculative per-entity log tables.
export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: text("action").notNull(), // e.g. "project.created", "expense.deleted"
  targetType: text("target_type").notNull(), // e.g. "project", "user", "expense"
  targetId: uuid("target_id"),
  detail: jsonb("detail"), // free-form diff / context, never raw file bytes
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type NewActivityLogEntry = typeof activityLog.$inferInsert;
