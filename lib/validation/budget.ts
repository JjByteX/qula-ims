import { z } from "zod";

// Allocated funds (phases-plan 2.1 / Client-Requests.md "Total budget the
// company has to work with"). A plain decimal string in, coerced to a
// number for range validation — numeric columns round-trip through
// Drizzle as strings (see db/schema/budget.ts), so the API keeps the same
// string shape end to end rather than converting back and forth.
export const allocatedFundsSchema = z.object({
  allocatedFunds: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .refine((val) => !Number.isNaN(Number(val)), "Enter a valid amount")
    .refine((val) => Number(val) >= 0, "Amount cannot be negative"),
});

export type AllocatedFundsInput = z.infer<typeof allocatedFundsSchema>;

// Actual expenses (phases-plan 2.2 / Client-Requests.md "Amount,
// Description, Date"). date is a plain YYYY-MM-DD string, matching how
// Drizzle's date() column round-trips (db/schema/budget.ts) — no Date
// object conversion needed since the column has no time component.
export const expenseSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .refine((val) => !Number.isNaN(Number(val)), "Enter a valid amount")
    .refine((val) => Number(val) > 0, "Amount must be greater than zero"),
  description: z.string().trim().min(1, "Description is required"),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

// Budget splitter (phases-plan 2.4 / Client-Requests.md "Splits the
// budget across team members. Equal split by default, but you can
// change it."). overrides carries only the people with a manual
// percentage; anyone not listed falls back to an equal share of what's
// left, computed server-side in app/api/budget/splitter/route.ts rather
// than trusting a client-computed equal share.
export const budgetSplitterSchema = z.object({
  enabled: z.boolean(),
  overrides: z
    .array(
      z.object({
        userId: z.string().uuid(),
        percentage: z
          .string()
          .trim()
          .min(1, "Percentage is required")
          .refine((val) => !Number.isNaN(Number(val)), "Enter a valid percentage")
          .refine((val) => Number(val) >= 0 && Number(val) <= 100, "Must be between 0 and 100"),
      }),
    )
    .refine(
      (overrides) => overrides.reduce((sum, o) => sum + Number(o.percentage), 0) <= 100,
      "Overrides can't add up to more than 100%",
    ),
});

export type BudgetSplitterInput = z.infer<typeof budgetSplitterSchema>;
