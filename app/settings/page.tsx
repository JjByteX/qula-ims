import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getOrCreateAppSettings } from "@/lib/settings/get";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationSettingsForm } from "./notification-settings-form";

// Settings (phases-plan 6). Open to any signed-in user — Client-Requests.md
// lists both items (notification lead time, profile edit) with no
// superadmin restriction, unlike account creation or approval.
export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getOrCreateAppSettings();

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
            Settings
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            Notification timing and your profile.
          </p>
        </div>

        <NotificationSettingsForm initialDaysBefore={settings.notificationDaysBefore} />

        {/* Profile edit shortcut (phases-plan 6.2). Links straight to
            this user's own edit form — /users/[id]/edit already enforces
            self-or-superadmin per phases-plan 1.7, so no separate check
            is needed here since the id in the link is always the
            signed-in user's own id. */}
        <Link href={`/users/${user.id}/edit`} className="block">
          <Card className="rounded-[var(--radius-lg)] transition-colors hover:bg-[var(--muted)]">
            <CardContent className="flex items-center justify-between gap-4 p-6">
              <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
                Profile
              </span>
              <span className="flex items-center gap-2 text-[var(--text-base)] text-[var(--foreground)]">
                <Pencil className="size-4" aria-hidden="true" />
                Edit your profile
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}
