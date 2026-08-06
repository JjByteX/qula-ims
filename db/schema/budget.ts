import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// Single ongoing allocated-funds record. Client-Requests.md describes one
// pool ("Total budget the company has to work with"), not period-scoped
// budgets, so this is a single-row table rather than a history of periods.
export const budget = pgTable("budget", {
  id: uuid("id").primaryKey().defaultRandom(),
  allocatedFunds: numeric("allocated_funds", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description").notNull(),
  date: date("date").notNull(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Per-person share of the budget, always split across the team. Equal
// split by default (computed at read time from active user count); a row
// here represents a manual override.
export const budgetSplits = pgTable("budget_splits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Percentage of the remaining budget allocated to this person (0-100).
  // Null means "use the equal-split default" for this user.
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Budget = typeof budget.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type BudgetSplit = typeof budgetSplits.$inferSelect;
