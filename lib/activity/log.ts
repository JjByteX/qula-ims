import { db } from "@/db/client";
import { activityLog } from "@/db/schema";

// Log writers (phases-plan 4.2). One insert, called directly from each
// mutation route right after its own db call succeeds — no event bus or
// queue, since writes here are low volume and don't need to be decoupled
// from the request that caused them. `detail` is optional free-form
// context (old/new values, counts, etc.); keep it to non-sensitive fields
// per AGENTS.md's monitoring rule, even though this table is internal
// rather than sent to Sentry/PostHog.
export async function logActivity(params: {
  // Nullable: self-registration (phases-plan 1.4) has no signed-in actor
  // yet — the applicant creating their own pending account.
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: Record<string, unknown>;
}) {
  await db.insert(activityLog).values({
    actorUserId: params.actorUserId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId ?? null,
    detail: params.detail ?? null,
  });
}
