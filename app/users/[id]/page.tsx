import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Mail, Phone, Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/app/dashboard/profile-menu";

// Profile view (phases-plan 1.7 / Client-Requests.md "Anyone can view any
// profile"). Any signed-in user can view any profile — the self-or-
// superadmin restriction only applies to the edit page.
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireUser();
  const { id } = await params;

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
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!profile) {
    notFound();
  }

  const fullName = [profile.firstName, profile.middleName, profile.lastName, profile.suffix]
    .filter(Boolean)
    .join(" ");
  const initials = `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();
  const canEdit = currentUser.id === profile.id || currentUser.role === "superadmin";

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
        {/* Same profile menu as the dashboard header, so Settings and
            Logout stay reachable from this page too instead of only
            from /dashboard. */}
        <div className="flex items-center justify-between">
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
        <Card className="rounded-[var(--radius-lg)]">
          <CardContent className="flex flex-col gap-6 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage src={profile.profilePictureUrl ?? undefined} alt="" />
                  <AvatarFallback className="text-[var(--text-lg)]">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <h1 className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
                    {fullName}
                  </h1>
                  <div className="flex items-center gap-2">
                    {profile.role === "superadmin" && <Badge variant="accent">Superadmin</Badge>}
                    {profile.status === "denied" && <Badge variant="destructive">Denied</Badge>}
                    {profile.status === "pending" && <Badge variant="outline">Pending</Badge>}
                  </div>
                </div>
              </div>

              {canEdit && (
                // Own profile now edits from Settings
                // (docs/phases-plan-revision-2.md Phase 21) rather than
                // this route's own /edit page — that page still exists
                // and still handles a superadmin editing someone else's
                // profile, which is the only remaining case that keeps
                // linking there.
                <Link href={currentUser.id === profile.id ? "/settings" : `/users/${profile.id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </Button>
                </Link>
              )}
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[var(--text-base)] text-[var(--foreground)]">
                <Mail className="size-4 text-[var(--muted-foreground)]" aria-hidden="true" />
                {profile.email}
              </div>
              {profile.contactNumber && (
                <div className="flex items-center gap-2 text-[var(--text-base)] text-[var(--foreground)]">
                  <Phone className="size-4 text-[var(--muted-foreground)]" aria-hidden="true" />
                  {profile.contactNumber}
                </div>
              )}
            </div>

            {profile.description && (
              <>
                <Separator />
                <p className="text-[var(--text-base)] text-[var(--foreground)]">
                  {profile.description}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
