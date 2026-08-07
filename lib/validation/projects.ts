import { z } from "zod";

// Project entity (phases-plan 3.1 / Client-Requests.md "Enter Project",
// revised). A project is now just a title — milestone and price live on
// each milestone row instead (lib/validation/milestones.ts), since a real
// engagement is usually billed in named stages rather than one flat price.
export const projectSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
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
