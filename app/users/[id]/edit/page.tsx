import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { EditProfileForm } from "./edit-profile-form";
import { ProfileMenu } from "@/app/dashboard/profile-menu";

// Profile edit (phases-plan 1.7 / Client-Requests.md "only superadmin or
// that person can edit it"). Unlike requireSuperadmin(), this is a
// per-record check that can't be decided from role alone, so it's done
// here rather than with a reusable session.ts helper.
//
// Own profile now edits from Settings (docs/phases-plan-revision-2.md
// Phase 21) — this page redirects there for that case, same as it
// already redirects unauthorized access to the profile-view page. What
// remains here is a superadmin editing someone else's profile, the one
// case Settings' own edit form doesn't cover (it only ever edits the
// signed-in user's own row).
export default async function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireUser();
  const { id } = await params;

  if (currentUser.id === id) {
    redirect("/settings");
  }

  if (currentUser.role !== "superadmin") {
    redirect(`/users/${id}`);
  }

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
    .where(eq(users.id, id))
    .limit(1);

  if (!profile) {
    notFound();
  }

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
        <EditProfileForm profile={profile} />
      </div>
    </main>
  );
}
