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
