import { z } from "zod";

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
