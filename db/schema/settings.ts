import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core";

// Single-row settings table. Only one setting exists today (notification
// lead time); more rows aren't needed until a second setting appears.
export const appSettings = pgTable("app_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  notificationDaysBefore: integer("notification_days_before").notNull().default(3),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppSettings = typeof appSettings.$inferSelect;
