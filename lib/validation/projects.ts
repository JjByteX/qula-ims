import { z } from "zod";

// Project entity (phases-plan 3.1 / Client-Requests.md "Enter Project",
// revised). A project is now just a title — milestone and price live on
// each milestone row instead (lib/validation/milestones.ts), since a real
// engagement is usually billed in named stages rather than one flat price.
//
// Billing default: billedToName/billedToAttention (phases-plan-revision-1.md
// Phase 8), reusable as-is when a document is created for one of this
// project's milestones (lib/validation/documents.ts). billedToName is
// required (phases-plan-revision-2.md Phase 13); billedToAttention stays
// optional. The four payment fields Phase 8 originally added here
// (paymentMethod/paymentAccountName/paymentBank/paymentAccountNumber)
// were removed in Phase 14 — a project no longer carries its own copy of
// that info; POST /api/projects/[id]/documents reads it straight from the
// designated payer's user profile instead (Settings > "Who receives
// payment").
// Blank string -> undefined so an untouched optional field never
// overwrites an existing value with "" (vs. simply not being sent) —
// billedToAttention is the only field this still applies to. Drizzle's
// .set() skips undefined-valued keys, so PATCHing with it left blank
// leaves the project's existing value alone rather than clearing it.
// ponytail: blanking billedToAttention never clears it once set — add an
// explicit "clear this field" affordance if that's ever actually needed.
const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((val) => (val ? val : undefined));

export const projectSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  // Required (docs/phases-plan-revision-2.md Phase 13) — every project
  // has a client, so this is no longer left for later. billedToAttention
  // stays optional: a specific contact person isn't always known yet.
  billedToName: z.string().trim().min(1, "Billed To is required"),
  billedToAttention: optionalTrimmed,
});

export type ProjectInput = z.infer<typeof projectSchema>;

const priceString = z
  .string()
  .trim()
  .min(1, "Price is required")
  .refine((val) => !Number.isNaN(Number(val)), "Enter a valid price")
  .refine((val) => Number(val) >= 0, "Price cannot be negative");

// Milestone entity. Its real job is the same one the old single-milestone
// field had — a reminder for the user, and prefill for the milestone's own
// Invoice/Acknowledgement Receipt — just repeated per stage instead of
// once per project.
export const milestoneSchema = z.object({
  title: z.string().trim().min(1, "Milestone title is required"),
  price: priceString,
});

export type MilestoneInput = z.infer<typeof milestoneSchema>;

// Reorder payload: the full ordered list of a project's milestone ids.
// Sent as one array rather than one request per moved item, so a drag
// that crosses several positions is a single atomic update.
export const milestoneReorderSchema = z.object({
  milestoneIds: z.array(z.string().uuid()).min(1, "At least one milestone is required"),
});

export type MilestoneReorderInput = z.infer<typeof milestoneReorderSchema>;
