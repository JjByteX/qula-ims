import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

// Single-row settings table. Only one setting exists today (who
// currently receives payment); more rows aren't needed until a second
// setting appears.
export const appSettings = pgTable("app_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Who currently receives payment (docs/phases-plan-revision-1.md Phase
  // 12) — a single-row setting rather than a column on users, since it's
  // an org-wide "who's currently getting paid" switch, not per-user
  // data. Nullable — nobody has to be designated; with no payer
  // designated, invoice/AR creation just leaves the payer-linked fields
  // blank (docs/phases-plan-revision-2.md Phase 14/16).
  designatedPayerUserId: uuid("designated_payer_user_id").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppSettings = typeof appSettings.$inferSelect;
