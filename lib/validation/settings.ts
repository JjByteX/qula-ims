import { z } from "zod";

// Notification settings (phases-plan 6.1 / Client-Requests.md "Set the
// number of days before the notification"). An integer day count, capped
// at a generous but sane upper bound — this isn't a lead time measured in
// years, and an unbounded value would let a typo silently break the
// due-soon comparisons wherever this setting is applied.
export const notificationSettingsSchema = z.object({
  notificationDaysBefore: z
    .number()
    .int("Enter a whole number of days")
    .min(0, "Days can't be negative")
    .max(365, "Enter 365 days or fewer"),
});

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;

// Designated payer (docs/phases-plan-revision-1.md Phase 12.3) — "who's
// currently getting paid" is always exactly one active user or nobody;
// there's no "clear the selection" affordance on the radio-button card
// (Client-Requests.md-style single-choice UI doesn't offer an unset
// option once someone is picked), so this only validates the "select
// one" case. Un-designating, if ever needed, is a direct DB operation,
// same as any other admin-only edge case this app doesn't build UI for.
export const designatedPayerSchema = z.object({
  designatedPayerUserId: z.string().uuid("Select a valid user"),
});

export type DesignatedPayerInput = z.infer<typeof designatedPayerSchema>;
