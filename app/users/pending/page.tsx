import { requireSuperadmin } from "@/lib/auth/session";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { PendingRequestsList } from "./pending-requests-list";

// Superadmin-only page (phases-plan 1.5). requireSuperadmin() redirects
// signed-out users to /login and signed-in non-superadmins to /dashboard —
// see lib/auth/session.ts for why those differ.
export default async function PendingRequestsPage() {
  await requireSuperadmin();

  const pending = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      middleName: users.middleName,
      lastName: users.lastName,
      suffix: users.suffix,
      email: users.email,
      contactNumber: users.contactNumber,
      description: users.description,
      profilePictureUrl: users.profilePictureUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.status, "pending"))
    .orderBy(asc(users.createdAt));

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-[840px] flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
            Pending requests
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            Review and approve or deny self-registration requests.
          </p>
        </div>

        <PendingRequestsList initialRequests={pending} />
      </div>
    </main>
  );
}
