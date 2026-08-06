import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { authorizeSuperadmin } from "@/lib/auth/authorize";

// List of self-registration submissions awaiting review (phases-plan 1.5 /
// Client-Requests.md "Superadmin approves or denies it"). Superadmin only —
// middleware.ts already blocks unauthenticated requests to /api/users/pending
// at the edge; authorizeSuperadmin() below is the actual role check.
export async function GET() {
  const auth = await authorizeSuperadmin();
  if (!auth.ok) return auth.response;

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

  return NextResponse.json({ pending });
}
