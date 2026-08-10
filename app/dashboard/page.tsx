import { desc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { computeSplits } from "@/lib/budget/compute";
import { db } from "@/db/client";
import { activityLog, expenses, milestones, projectDocuments, projects, users } from "@/db/schema";
import { BudgetSection } from "./budget-section";
import { ActiveProjects, type ActiveProjectRow } from "./active-projects";
import { RecentActivity } from "./recent-activity";
import { ProfileMenu } from "./profile-menu";

// Last 5 to 10 entries (phases-plan 5.4 / Client-Requests.md) — 10 is the
// top of that range, so the dashboard shows as much as the spec allows
// rather than the minimum.
const RECENT_ACTIVITY_LIMIT = 10;

// Dashboard (phases-plan 5). Same view for every role — Client-Requests.md
// "Same view for everyone, superadmin included".
//
// The budget module (phases-plan 2) lives here as one editable section
// rather than a separate /budget page — Client-Requests.md never scopes
// Budget as its own page, and per the card-fragmentation rule in
// docs/ux-ui-guidelines.md the allocated funds, expenses, remaining
// total, and split are one logical concept. Active projects (5.2) and
// recent activity (5.4) fill out the rest of the grid. Navigation (5.5)
// is satisfied by each section already linking to its full page — no
// separate component needed for that phase. The header notification
// menu (pending registrations / milestones awaiting a document) was
// removed — the app is small enough that those are fine to just check
// on their own pages (/users/pending, each project) instead of being
// proactively flagged.
export default async function DashboardPage() {
  const user = await requireUser();

  const [snapshot, expenseList, activeProjects, recentActivity] = await Promise.all([
    computeSplits(),
    db.select().from(expenses).orderBy(desc(expenses.date)),
    db.select().from(projects).where(eq(projects.status, "active")).orderBy(desc(projects.createdAt)),
    // Same join shape as app/activity/page.tsx's full log query, just
    // capped to RECENT_ACTIVITY_LIMIT instead of PAGE_SIZE.
    db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        targetType: activityLog.targetType,
        detail: activityLog.detail,
        createdAt: activityLog.createdAt,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
      })
      .from(activityLog)
      .leftJoin(users, eq(activityLog.actorUserId, users.id))
      .orderBy(desc(activityLog.createdAt))
      .limit(RECENT_ACTIVITY_LIMIT),
  ]);

  // computeSplits() already reads (and lazily creates) the single budget
  // row internally, and returns allocatedFunds as part of its result — so
  // this reuses that instead of a second, potentially racy query for the
  // same row.
  const allocatedFunds = String(snapshot.allocatedFunds);

  // Flags mirror the per-milestone logic on the project detail page
  // (app/projects/[id]/milestones-section.tsx), now evaluated per
  // milestone instead of per project — a project's "unpaid invoice" or
  // "AR pending" state is the union across all of its milestones. Both
  // fetched here in one pass across every active project rather than N+1
  // queries per project.
  const [allMilestones, allDocuments] = activeProjects.length
    ? await Promise.all([
        db
          .select()
          .from(milestones)
          .where(
            inArray(
              milestones.projectId,
              activeProjects.map((p) => p.id),
            ),
          ),
        db.select().from(projectDocuments),
      ])
    : [[], []];

  const projectRows: ActiveProjectRow[] = activeProjects.map((project) => {
    const projectMilestones = allMilestones.filter((m) => m.projectId === project.id);
    const projectDocs = allDocuments.filter((doc) => doc.projectId === project.id);
    const hasUnpaidInvoice = projectDocs.some((doc) => doc.type === "invoice" && !doc.isPaid);

    // A milestone is "AR pending" once it's completed and has no AR
    // document billed against it specifically (project_documents.milestoneId).
    const arPending = projectMilestones.some((m) => {
      if (m.status !== "completed") return false;
      return !projectDocs.some((doc) => doc.milestoneId === m.id && doc.type === "ar");
    });

    const totalPrice = projectMilestones.reduce((sum, m) => sum + Number(m.price), 0).toFixed(2);
    const completedMilestoneCount = projectMilestones.filter((m) => m.status === "completed").length;

    // Next milestone = earliest-sortOrder pending one, same ordering the
    // project detail page's milestones-section uses. undefined when every
    // milestone is completed (nothing "next" to show).
    const nextMilestone = projectMilestones
      .filter((m) => m.status === "pending")
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))[0];

    return {
      id: project.id,
      title: project.title,
      milestoneCount: projectMilestones.length,
      completedMilestoneCount,
      price: totalPrice,
      hasUnpaidInvoice,
      arPending,
      nextMilestone: nextMilestone
        ? { title: nextMilestone.title, price: nextMilestone.price }
        : undefined,
    };
  });

  // Not-yet-earned milestones across every active project — surfaced in
  // the compact split row (BudgetSection) as "what's left to earn",
  // reusing allMilestones instead of a separate query.
  const pendingMilestones = allMilestones.filter((m) => m.status !== "completed");
  const pendingMilestoneCount = pendingMilestones.length;
  const pendingMilestonesTotal = pendingMilestones
    .reduce((sum, m) => sum + Number(m.price), 0)
    .toFixed(2);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 overflow-hidden px-6 pb-10">
        {/* Header shares the same max-width container and side padding as
            the card grid below, so the logo aligns with the grid's left
            edge and the profile menu aligns with its right edge instead
            of tracking the viewport edges independently. No pb- here —
            the parent's gap-6 alone provides the space below the logo,
            matching the gap-6 between cards in the grid, now that there's
            no subtitle line to space away from. */}
        <div className="flex shrink-0 items-center justify-between gap-4 pt-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- static
              brand asset from /public, not a next/image candidate */}
          <a href="/dashboard" aria-label="Go to dashboard">
            <img src="/qula-logo.svg" alt="Qula" className="h-8 w-auto self-start" />
          </a>
          <div className="flex items-center gap-2">
            <ProfileMenu
              user={{
                firstName: user.firstName,
                lastName: user.lastName,
                profilePictureUrl: user.profilePictureUrl,
              }}
            />
          </div>
        </div>

        {/* Grid fills the remaining viewport height. Budget (with its
            split, allocated funds, and expenses) spans both rows in the
            left column (row-span-2, 1x2) — active projects and
            recent activity stack in the right column instead. min-h-0
            lets a grid item shrink below its content size, which is what
            allows the scroll areas inside each card to kick in instead of
            the row growing to fit the tallest card's content. */}
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-6 lg:grid-cols-2">
          <div className="h-full min-h-0 lg:row-span-2">
            <BudgetSection
              initialAllocatedFunds={allocatedFunds}
              initialExpenses={expenseList}
              initialSplitterState={snapshot}
              pendingMilestoneCount={pendingMilestoneCount}
              pendingMilestonesTotal={pendingMilestonesTotal}
            />
          </div>
          <ActiveProjects projects={projectRows} />
          <RecentActivity entries={recentActivity} />
        </div>
      </div>
    </main>
  );
}
