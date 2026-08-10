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
    // Same fit-to-viewport shape as app/projects/page.tsx: h-screen +
    // overflow-hidden on main, so the page itself never scrolls — the
    // table below fits exactly as many rows as the viewport allows via
    // its own auto-fit pagination (see activity-log-list.tsx) instead of
    // either page scroll or an internal table scrollbar.
    <main className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 overflow-hidden px-6 pb-10">
        <div className="flex shrink-0 items-center justify-between gap-4 pt-10">
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

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <span className="shrink-0 text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Activity log
          </span>

          <ActivityLogList
            initialEntries={entries}
            initialTotal={total}
            pageSize={PAGE_SIZE}
            actors={actors}
          />
        </div>
      </div>
    </main>
  );
}
