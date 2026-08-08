import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appSettings, users } from "@/db/schema";
import { getOrCreateAppSettings } from "@/lib/settings/get";
import { designatedPayerSchema } from "@/lib/validation/settings";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

// Sets "who's currently getting paid" (docs/phases-plan-revision-1.md
// Phase 12.3) — a separate route from PATCH /api/settings rather than
// folding this into that route's body, since this is a distinct action
// (picking one active user) with its own validation, not another
// free-form settings field.
//
// Any signed-in user, same reasoning as the rest of Settings
// (app/api/settings/route.ts): Client-Requests.md draws no view/edit
// distinction here, and this is a shared app-wide switch, not per-
// profile data gated by the self-or-superadmin rule used for editing an
// individual's own profile.
//
// Changing this never touches documents already generated — it only
// affects what Phase 9's server-side prefill reads going forward for new
// invoices (same snapshot principle used everywhere else in the document
// system). See app/api/projects/[id]/documents/route.ts.
export async function PATCH(request: Request) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = designatedPayerSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [candidate] = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(eq(users.id, parsed.data.designatedPayerUserId))
    .limit(1);
  if (!candidate) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (candidate.status !== "active") {
    return NextResponse.json(
      { error: "Only an active user can be the designated payer." },
      { status: 400 },
    );
  }

  const current = await getOrCreateAppSettings();
  const [updated] = await db
    .update(appSettings)
    .set({
      designatedPayerUserId: parsed.data.designatedPayerUserId,
      updatedAt: new Date(),
    })
    .where(eq(appSettings.id, current.id))
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "settings.designated_payer_updated",
    targetType: "settings",
    targetId: updated.id,
    detail: {
      previous: current.designatedPayerUserId,
      next: updated.designatedPayerUserId,
    },
  });

  return NextResponse.json({ settings: updated });
}
