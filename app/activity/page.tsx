import { desc, eq, count } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { activityLog, users } from "@/db/schema";
import { ActivityLogList } from "./activity-log-list";

const PAGE_SIZE = 25;

// Full activity log page (phases-plan 4.3), open to any signed-in user —
// same reasoning as app/api/activity/route.ts. First page of unfiltered
// results is fetched directly here (same pattern as app/dashboard/page.tsx),
// so the initial paint has real data; ActivityLogList takes over via
// GET /api/activity for any filter or page change afterward.
export default async function ActivityLogPage() {
  await requireUser();

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
        <div className="flex flex-col gap-1">
          <h1 className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
            Activity log
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            Every account, budget, project, and document change, in one place.
          </p>
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
