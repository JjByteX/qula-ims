import { db } from "@/db/client";
import { appSettings } from "@/db/schema";

// Single ongoing settings record, same reasoning as
// lib/budget/compute.ts's getOrCreateBudget(): the row isn't seeded by a
// migration, so this reads it if it exists or creates a default-valued
// one on first access. Shared here (phases-plan 6.1 "apply this setting
// wherever notification timing is used") so app/api/settings/route.ts,
// app/settings/page.tsx, and any page that needs to compute a "due soon"
// flag from notificationDaysBefore all read the exact same row instead
// of duplicating this get-or-create.
export async function getOrCreateAppSettings() {
  const [existing] = await db.select().from(appSettings).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(appSettings).values({}).returning();
  return created;
}
