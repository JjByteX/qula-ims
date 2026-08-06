import { z } from "zod";

// Project entity (phases-plan 3.1 / Client-Requests.md "Enter Project").
// Client-Requests.md is explicit that this record's real job is prefill
// for the Invoice and Acknowledgement Receipt (phases-plan 3.3), so it
// stays exactly these three fields rather than growing into a fuller
// project-management model. price is a plain decimal string in, same
// string-round-trip reasoning as budget.ts's allocatedFundsSchema —
// numeric columns come back as strings from Drizzle.
export const projectSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  milestone: z.string().trim().min(1, "Milestone is required"),
  price: z
    .string()
    .trim()
    .min(1, "Price is required")
    .refine((val) => !Number.isNaN(Number(val)), "Enter a valid price")
    .refine((val) => Number(val) >= 0, "Price cannot be negative"),
});

export type ProjectInput = z.infer<typeof projectSchema>;
