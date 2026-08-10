import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { milestones, projectDocuments } from "@/db/schema";

// Auto-calculates an AR's "Remaining Balance" — this used to be a field
// someone typed in by hand (remainingBalance in
// lib/validation/documents.ts), which meant it could drift from the
// actual numbers on the project. It's now always derived, never edited
// directly:
//
//   remaining balance = sum(all milestone prices on the project)
//                      - sum(prices of milestones "done" so far)
//
// "Done" means the milestone already has an AR — an AR is only ever
// created once a milestone is completed and paid (see the "completed
// before invoice/AR" gate in app/api/projects/[id]/documents/route.ts),
// so an existing AR is the actual signal that money for that milestone
// has been received, not just that the work is finished.
//
// includeMilestoneId lets the *current* milestone count as "done" before
// its own AR row exists yet — needed when computing the balance to store
// on the AR being created right now, since at that point in the request
// the milestone is completed but this AR hasn't been inserted yet.
export async function computeArRemainingBalance(
  projectId: string,
  includeMilestoneId?: string,
): Promise<string> {
  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${milestones.price}), 0)` })
    .from(milestones)
    .where(eq(milestones.projectId, projectId));

  const doneMilestoneRows = await db
    .select({ milestoneId: projectDocuments.milestoneId, price: milestones.price })
    .from(projectDocuments)
    .innerJoin(milestones, eq(projectDocuments.milestoneId, milestones.id))
    .where(and(eq(projectDocuments.projectId, projectId), eq(projectDocuments.type, "ar")));

  const doneMilestoneIds = new Set(doneMilestoneRows.map((row) => row.milestoneId));
  let doneTotal = doneMilestoneRows.reduce((sum, row) => sum + Number(row.price), 0);

  if (includeMilestoneId && !doneMilestoneIds.has(includeMilestoneId)) {
    const [includedMilestone] = await db
      .select({ price: milestones.price })
      .from(milestones)
      .where(eq(milestones.id, includeMilestoneId))
      .limit(1);
    if (includedMilestone) {
      doneTotal += Number(includedMilestone.price);
    }
  }

  const remaining = Number(total) - doneTotal;
  return remaining.toFixed(2);
}
