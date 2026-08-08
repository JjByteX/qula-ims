import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

// Single-row settings table. Only one setting exists today (notification
// lead time); more rows aren't needed until a second setting appears.
export const appSettings = pgTable("app_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  notificationDaysBefore: integer("notification_days_before").notNull().default(3),
  // Who currently receives payment (docs/phases-plan-revision-1.md Phase
  // 12) — a single-row setting rather than a column on users, same
  // reasoning as this table's existing notificationDaysBefore: it's an
  // org-wide "who's currently getting paid" switch, not per-user data.
  // Nullable — nobody has to be designated; Phase 9's invoice prefill
  // just falls back to the project's own billing defaults until someone
  // is.
  designatedPayerUserId: uuid("designated_payer_user_id").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppSettings = typeof appSettings.$inferSelect;
