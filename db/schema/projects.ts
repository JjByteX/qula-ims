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

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  milestone: text("milestone").notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  status: projectStatusEnum("status").notNull().default("active"),
  // Status tracking (phases-plan 3.4): "Finished milestones with no
  // invoice or AR made yet" (Client-Requests.md dashboard spec) needs a
  // fact to check against — this is that fact. Separate from `status`
  // (active/archived), which is about visibility, not progress: a
  // project stays active and visible while its current milestone is
  // marked complete, so the team can then issue the invoice/AR before
  // archiving or moving on.
  milestoneCompleted: boolean("milestone_completed").notNull().default(false),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentTypeEnum = pgEnum("document_type", ["invoice", "ar"]);

// Invoice / Acknowledgement Receipt. Lives on the project page (phases-plan
// 3.2). Two ways a document gets here:
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
  type: documentTypeEnum("type").notNull(),

  // Prefilled from the project at creation time, editable afterward.
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
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type NewProjectDocument = typeof projectDocuments.$inferInsert;
