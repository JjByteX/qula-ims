import { NextResponse } from "next/server";
import { and, desc, eq, gte, lte, count } from "drizzle-orm";
import { db } from "@/db/client";
import { activityLog, users } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";

const PAGE_SIZE = 25;

// Full activity log (phases-plan 4.3), open to any signed-in user — the
// log itself carries no view restriction in Client-Requests.md, unlike
// e.g. pending requests which are superadmin-only.
export async function GET(request: Request) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const actorUserId = params.get("actor") || undefined;
  const action = params.get("action") || undefined;
  const from = params.get("from") || undefined; // YYYY-MM-DD
  const to = params.get("to") || undefined; // YYYY-MM-DD
  const page = Math.max(1, Number(params.get("page")) || 1);

  const conditions = [
    actorUserId ? eq(activityLog.actorUserId, actorUserId) : undefined,
    action ? eq(activityLog.action, action) : undefined,
    from ? gte(activityLog.createdAt, new Date(`${from}T00:00:00`)) : undefined,
    // End-of-day so "to" is inclusive of the whole selected date.
    to ? lte(activityLog.createdAt, new Date(`${to}T23:59:59.999`)) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(activityLog)
    .where(where);

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
    .where(where)
    .orderBy(desc(activityLog.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return NextResponse.json({
    entries,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
