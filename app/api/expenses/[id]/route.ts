import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import { expenseSchema } from "@/lib/validation/budget";
import { authorizeUser } from "@/lib/auth/authorize";

// Edit (phases-plan 2.2). Any signed-in user, same as create — see
// app/api/expenses/route.ts for why this isn't self-or-superadmin gated
// the way profile edits are.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const [existing] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [updated] = await db
    .update(expenses)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(expenses.id, id))
    .returning();

  return NextResponse.json({ expense: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const [existing] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }

  await db.delete(expenses).where(eq(expenses.id, id));
  return NextResponse.json({ success: true });
}
