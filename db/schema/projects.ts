import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  numeric,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const projectStatusEnum = pgEnum("project_status", ["active", "archived"]);
export const milestoneStatusEnum = pgEnum("milestone_status", ["pending", "completed"]);

// A project is now a container for one or more milestones (Client-Requests.md
// "Enter Project" was revised: a real engagement is usually billed in named
// stages — see the payment-breakdown shape in reference proposals — not one
// flat price). The project itself no longer carries milestone/price
// directly; both are now properties of each milestone row, and the
// project's displayed price is the sum of its milestones' prices
// (computed in queries, not stored, so it never drifts).
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  status: projectStatusEnum("status").notNull().default("active"),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per milestone. sortOrder is explicit (rather than relying on
// createdAt) so milestones can be reordered independently of creation
// order — e.g. inserting a stage between two existing ones.
export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  status: milestoneStatusEnum("status").notNull().default("pending"),
  sortOrder: numeric("sort_order", { precision: 10, scale: 2 }).notNull().default("0"),
  // Set when status flips to "completed", cleared on reopen — same
  // signal completeMilestone/reopenMilestone routes need for ordering
  // "recently completed" lists without a separate query.
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentTypeEnum = pgEnum("document_type", ["invoice", "ar"]);

// Invoice / Acknowledgement Receipt. Lives on the project page (phases-plan
// 3.2), scoped to one milestone — each milestone is billed independently
// (a project with several milestones issues a separate invoice/AR per
// stage, matching how real engagements are actually billed). Two ways a
// document gets here:
//   1. Uploaded as-is (fileUrl/fileName set) — doc/PDF only, per
//      Client-Requests.md — an existing file someone already has.
//   2. Generated in-app from the fields below, matching the client's real
//      AR/invoice templates (monochrome, Times New Roman). fileUrl is null
//      for these; the rendered view lives at
//      /projects/[projectId]/documents/[id].
// Both share one table since a project's document list needs to show both
// kinds together, sorted the same way. fileUrl/fileName are nullable
// because generated documents don't have an uploaded file.
export const projectDocuments = pgTable("project_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  // Kept alongside projectId (rather than looked up through it) so a
  // document is never ambiguous about which milestone it bills, and so
  // deleting/reordering other milestones on the same project can't
  // silently change which one a past document belonged to.
  milestoneId: uuid("milestone_id")
    .notNull()
    .references(() => milestones.id, { onDelete: "cascade" }),
  type: documentTypeEnum("type").notNull(),

  // Prefilled from the project + milestone at creation time, editable
  // afterward. "milestone" here is a text snapshot (the milestone's title
  // at issue time), not a live reference — matches how title/price are
  // already snapshotted, so a later milestone rename never rewrites a
  // document that already went out.
  title: text("title").notNull(),
  milestone: text("milestone").notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),

  // Set when the document is an uploaded file rather than generated.
  fileUrl: text("file_url"),
  fileName: text("file_name"),

  // --- Generated-document fields (both types) ---------------------------
  documentNumber: text("document_number"), // e.g. "AR-2026-002", "INV-2026-014"
  documentDate: date("document_date"),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  amountInWords: text("amount_in_words"),
  paymentPurpose: text("payment_purpose"),

  // --- AR-only ------------------------------------------------------------
  receivedFromName: text("received_from_name"), // client company
  receivedFromAttention: text("received_from_attention"), // client contact person
  remainingBalance: numeric("remaining_balance", { precision: 14, scale: 2 }),
  receivedByName: text("received_by_name"),
  receivedByTitle: text("received_by_title"),

  // --- Invoice-only --------------------------------------------------------
  billedToName: text("billed_to_name"),
  billedToAttention: text("billed_to_attention"),
  dueDate: date("due_date"),
  agreementDate: date("agreement_date"),
  totalProjectCost: numeric("total_project_cost", { precision: 14, scale: 2 }),
  paymentMethod: text("payment_method"),
  paymentAccountName: text("payment_account_name"),
  paymentBank: text("payment_bank"),
  paymentAccountNumber: text("payment_account_number"),
  paymentReferenceNote: text("payment_reference_note"),
  qrCodeUrl: text("qr_code_url"), // uploaded QR image, not generated
  issuedBy: text("issued_by"),

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
export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type NewProjectDocument = typeof projectDocuments.$inferInsert;
