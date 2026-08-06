import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appSettings } from "@/db/schema";
import { getOrCreateAppSettings } from "@/lib/settings/get";
import { notificationSettingsSchema } from "@/lib/validation/settings";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

// View is open to any signed-in user, same reasoning as
// app/api/budget/route.ts — Client-Requests.md draws no view/edit
// distinction here either.
export async function GET() {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const current = await getOrCreateAppSettings();
  return NextResponse.json({ settings: current });
}

// Update the notification lead time (phases-plan 6.1). Any signed-in
// user, not superadmin-only — this is a shared app-wide preference, not
// per-profile data, and nothing in Client-Requests.md restricts it to
// superadmin the way account creation is restricted.
export async function PATCH(request: Request) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = notificationSettingsSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const current = await getOrCreateAppSettings();
  const [updated] = await db
    .update(appSettings)
    .set({
      notificationDaysBefore: parsed.data.notificationDaysBefore,
      updatedAt: new Date(),
    })
    .where(eq(appSettings.id, current.id))
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "settings.notification_days_updated",
    targetType: "settings",
    targetId: updated.id,
    detail: {
      previous: current.notificationDaysBefore,
      next: updated.notificationDaysBefore,
    },
  });

  return NextResponse.json({ settings: updated });
}
