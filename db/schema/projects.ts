import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const projectStatusEnum = pgEnum("project_status", ["active", "archived"]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  milestone: text("milestone").notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  status: projectStatusEnum("status").notNull().default("active"),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentTypeEnum = pgEnum("document_type", ["invoice", "ar"]);

// Invoice / Acknowledgement Receipt. Lives on the project page, doc/PDF only.
export const projectDocuments = pgTable("project_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: documentTypeEnum("type").notNull(),

  // Prefilled from the project at creation time, editable afterward.
  title: text("title").notNull(),
  milestone: text("milestone").notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),

  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),

  // Only meaningful for type = "invoice".
  isPaid: boolean("is_paid").notNull().default(false),

  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type NewProjectDocument = typeof projectDocuments.$inferInsert;
