import { desc, eq, count } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { activityLog, users } from "@/db/schema";
import { ActivityLogList } from "./activity-log-list";
import { ProfileMenu } from "@/app/dashboard/profile-menu";

const PAGE_SIZE = 25;

// Full activity log page (phases-plan 4.3), open to any signed-in user —
// same reasoning as app/api/activity/route.ts. First page of unfiltered
// results is fetched directly here (same pattern as app/dashboard/page.tsx),
// so the initial paint has real data; ActivityLogList takes over via
// GET /api/activity for any filter or page change afterward.
export default async function ActivityLogPage() {
  const currentUser = await requireUser();

  const [{ total }] = await db.select({ total: count() }).from(activityLog);

  const entries = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      targetType: activityLog.targetType,
      targetId: activityLog.targetId,
      detail: activityLog.detail,
      createdAt: activityLog.createdAt,
      actorUserId: activityLog.actorUserId,
      actorFirstName: users.firstName,
      actorLastName: users.lastName,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.actorUserId, users.id))
    .orderBy(desc(activityLog.createdAt))
    .limit(PAGE_SIZE);

  // Actor filter options (phases-plan 4.3): everyone who has ever acted,
  // not just currently-active users, so filtering by someone who was
  // later denied or whose account changed still finds their past entries.
  const actors = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .orderBy(users.firstName);

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
        {/* Same profile menu as the dashboard header, so Settings and
            Logout stay reachable from this page too instead of only
            from /dashboard. */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- static
                brand asset from /public, not a next/image candidate */}
            <a href="/dashboard" aria-label="Go to dashboard">
              <img src="/qula-logo.svg" alt="Qula" className="h-8 w-auto self-start" />
            </a>
            <div className="flex flex-col gap-1">
              <h1 className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
                Activity log
              </h1>
              <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                Every account, budget, project, and document change, in one place.
              </p>
            </div>
          </div>
          <ProfileMenu
            user={{
              firstName: currentUser.firstName,
              lastName: currentUser.lastName,
              profilePictureUrl: currentUser.profilePictureUrl,
            }}
          />
        </div>

        <ActivityLogList
          initialEntries={entries}
          initialTotal={total}
          pageSize={PAGE_SIZE}
          actors={actors}
        />
      </div>
    </main>
  );
}
