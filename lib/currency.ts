// Currency display formatting shared across server components (e.g.
// app/dashboard/active-projects.tsx) and client components (e.g.
// app/dashboard/budget-section.tsx).
//
// This file intentionally has zero dependencies and no "use client"
// directive. Next.js treats every export of a "use client" file as
// client-only — even a plain, side-effect-free function like
// formatCurrency — so a server component that imported these from
// budget-section.tsx (which is "use client" for its form state) would
// fail at render with "Attempted to call formatCurrency() from the
// server". Keeping the constant and the formatter here, with nothing
// else in the file, makes it safe to import from either side.

// Philippine peso — this is a Philippine engagement (Client-Requests.md
// and the reference proposals price everything in ₱), so this is a
// single constant to change in one place rather than a guess baked into
// every display.
export const CURRENCY_SYMBOL = "₱";

// Matches the numeric(14,2) column: whole-number grouping, exactly two
// decimals — this is a display formatter only, the raw string is what's
// actually sent to and stored by the API.
export function formatCurrency(value: string): string {
  const amount = Number(value);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
