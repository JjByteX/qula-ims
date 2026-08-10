import { requireSuperadmin } from "@/lib/auth/session";
import { CreateAccountForm } from "./create-account-form";
import { ProfileMenu } from "@/app/dashboard/profile-menu";

// Superadmin-only page (phases-plan 1.6). requireSuperadmin() redirects
// signed-out users to /login and signed-in non-superadmins to /dashboard.
export default async function CreateAccountPage() {
  const currentUser = await requireSuperadmin();

  return (
    <main className="flex min-h-screen flex-col items-center bg-[var(--background)] px-4 py-10">
      {/* Same profile menu as the dashboard header, so Settings and
          Logout stay reachable from this page too instead of only
          from /dashboard. */}
      <div className="flex w-full max-w-[640px] items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element -- static
            brand asset from /public, not a next/image candidate */}
        <a href="/dashboard" aria-label="Go to dashboard">
          <img src="/qula-logo.svg" alt="Qula" className="h-8 w-auto self-start" />
        </a>
        <ProfileMenu
          user={{
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            profilePictureUrl: currentUser.profilePictureUrl,
          }}
        />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <CreateAccountForm />
      </div>
    </main>
  );
}
