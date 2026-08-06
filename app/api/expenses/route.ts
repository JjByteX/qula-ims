import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import { expenseSchema } from "@/lib/validation/budget";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

// Any signed-in user can view and create expenses (phases-plan 2.2 /
// Client-Requests.md "Regular users can edit everything else in the
// system... budget..."), same as allocated funds — no per-owner edit
// restriction the way profiles have one.
export async function GET() {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  // Sorted by date per phases-plan 2.2's "expense list view with sorting
  // by date" — most recent first, since that's what you'd want to review
  // when checking recent spending.
  const list = await db.select().from(expenses).orderBy(desc(expenses.date));
  return NextResponse.json({ expenses: list });
}

export async function POST(request: Request) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [created] = await db
    .insert(expenses)
    .values({ ...parsed.data, createdByUserId: auth.user.id })
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "expense.created",
    targetType: "expense",
    targetId: created.id,
    detail: { amount: created.amount, description: created.description },
  });

  return NextResponse.json({ expense: created });
}
