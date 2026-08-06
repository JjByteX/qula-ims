import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { EditProfileForm } from "./edit-profile-form";

// Profile edit (phases-plan 1.7 / Client-Requests.md "only superadmin or
// that person can edit it"). Unlike requireSuperadmin(), this is a
// per-record check that can't be decided from role alone, so it's done
// here rather than with a reusable session.ts helper.
export default async function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireUser();
  const { id } = await params;

  if (currentUser.id !== id && currentUser.role !== "superadmin") {
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
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!profile) {
    notFound();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <EditProfileForm profile={profile} />
    </main>
  );
}
