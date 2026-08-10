import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getOrCreateAppSettings } from "@/lib/settings/get";
import { DesignatedPayerCard } from "./designated-payer-card";
import { EditProfileForm } from "@/app/users/[id]/edit/edit-profile-form";
import { ProfileMenu } from "@/app/dashboard/profile-menu";

// Settings (phases-plan 6, revised by docs/phases-plan-revision-2.md
// Phase 21). Open to any signed-in user — Client-Requests.md lists both
// items (who receives payment, profile edit) with no superadmin
// restriction, unlike account creation or approval.
//
// The profile edit form used to live on its own page
// (/users/[id]/edit) with Settings only linking out to it — that page
// still exists and still handles a superadmin editing someone else's
// profile, but for editing your own profile, the form now renders right
// here instead, since a link to a mostly-empty page added a click for
// no reason. Wide dashboard-style container (max-w-[1600px], full
// height) instead of the old narrow centered column, so the form
// actually uses the space instead of being squeezed into 480px next to
// a lot of empty margin.
export default async function SettingsPage() {
  const currentUser = await requireUser();
  const settings = await getOrCreateAppSettings();

  // Active users with their payment-profile completeness (docs/phases-
  // plan-revision-1.md Phase 12.3's "Who receives payment" card).
  // Queried directly here rather than through
  // lib/budget/compute.ts's getActiveUsers() — that helper is shared
  // with the budget splitter and only needs id/name, so it isn't worth
  // widening its select just for this one card's payment-completeness
  // check.
  const activeUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      paymentMethod: users.paymentMethod,
      paymentAccountName: users.paymentAccountName,
      paymentBank: users.paymentBank,
      paymentAccountNumber: users.paymentAccountNumber,
    })
    .from(users)
    .where(eq(users.status, "active"));

  const payerOptions = activeUsers.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    profileComplete: Boolean(
      u.paymentMethod && u.paymentAccountName && u.paymentBank && u.paymentAccountNumber,
    ),
  }));

  // Full profile row for the edit form below — requireUser()'s session
  // user is a lighter shape, same reasoning app/users/[id]/edit/page.tsx
  // already follows for the same form.
  const [profile] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      middleName: users.middleName,
      lastName: users.lastName,
      suffix: users.suffix,
      contactNumber: users.contactNumber,
      description: users.description,
      profilePictureUrl: users.profilePictureUrl,
      paymentQrCodeUrl: users.paymentQrCodeUrl,
      paymentMethod: users.paymentMethod,
      paymentAccountName: users.paymentAccountName,
      paymentBank: users.paymentBank,
      paymentAccountNumber: users.paymentAccountNumber,
      paymentSignatureUrl: users.paymentSignatureUrl,
    })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .limit(1);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 overflow-hidden px-6 pb-10">
        <div className="flex shrink-0 items-center justify-between gap-2 pt-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- static
              brand asset from /public, not a next/image candidate */}
          <a href="/dashboard" aria-label="Go to dashboard">
            <img src="/qula-logo.svg" alt="Qula" className="h-8 w-auto self-start" />
          </a>
          {/* Same profile menu as the dashboard header, so it stays
              reachable here too instead of disappearing once you leave
              /dashboard. */}
          <ProfileMenu
            user={{
              firstName: currentUser.firstName,
              lastName: currentUser.lastName,
              profilePictureUrl: currentUser.profilePictureUrl,
            }}
          />
        </div>

        <span className="shrink-0 text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
          Settings
        </span>

        {/* Payer card sits at its natural height (shrink-0) — it's
            short and fixed-shape, stretching it would just add empty
            white space inside it. Edit profile takes the rest of the
            column (flex-1, min-h-0) and — like the dashboard's cards
            (see RecentActivity) — its own Card is h-full so the white
            box itself reaches the bottom of the viewport, with the
            form scrolling internally if it's taller than the space
            left. That's what actually closes the gap the dashboard
            doesn't have: not page scroll, but the card stretching. */}
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className="shrink-0">
            <DesignatedPayerCard
              users={payerOptions}
              initialDesignatedPayerUserId={settings.designatedPayerUserId}
            />
          </div>
          {profile && (
            <div className="min-h-0 flex-1">
              <EditProfileForm profile={profile} stayOnPage fillHeight />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
