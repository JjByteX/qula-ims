import { pgTable, pgEnum, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["superadmin", "user"]);

export const userStatusEnum = pgEnum("user_status", [
  "pending", // self-registered, awaiting superadmin approval
  "active",
  "denied",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Auth
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),

  // Profile fields (per Client-Requests.md)
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  suffix: text("suffix"),
  contactNumber: text("contact_number"),
  description: text("description"),
  profilePictureUrl: text("profile_picture_url"),

  // Access control
  role: userRoleEnum("role").notNull().default("user"),
  status: userStatusEnum("status").notNull().default("pending"),

  // Who approved/created this account, for audit purposes
  createdByUserId: uuid("created_by_user_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
