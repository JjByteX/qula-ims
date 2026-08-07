import { desc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { computeSplits } from "@/lib/budget/compute";
import { db } from "@/db/client";
import { activityLog, expenses, milestones, projectDocuments, projects, users } from "@/db/schema";
import { BudgetSection } from "./budget-section";
import { ActiveProjects, type ActiveProjectRow } from "./active-projects";
import {
  NotificationMenu,
  type MilestoneAwaitingDocument,
  type PendingRegistration,
} from "./notification-menu";
import { RecentActivity } from "./recent-activity";
import { ProfileMenu } from "./profile-menu";

// Last 5 to 10 entries (phases-plan 5.4 / Client-Requests.md) — 10 is the
// top of that range, so the dashboard shows as much as the spec allows
// rather than the minimum.
const RECENT_ACTIVITY_LIMIT = 10;

// Dashboard (phases-plan 5). Same view for every role — Client-Requests.md
// "Same view for everyone, superadmin included" — so this never branches
// on auth.user.role the way e.g. app/users/pending/page.tsx does, except
// for the one sub-section that's explicitly superadmin-only by spec (5.3).
//
// The budget module (phases-plan 2) lives here as one editable section
// rather than a separate /budget page — Client-Requests.md never scopes
// Budget as its own page, and per the card-fragmentation rule in
// docs/ux-ui-guidelines.md the allocated funds, expenses, remaining
// total, and split are one logical concept. Active projects (5.2) and
// recent activity (5.4) fill out the rest of the grid; pending actions
// (5.3) surfaces through the header's NotificationMenu instead of its
// own card, since it's an alert to check rather than something read at
// a glance alongside the other cards. Navigation (5.5) is satisfied by
// each section already linking to its full page — no separate component
// needed for that phase.
export default async function DashboardPage() {
  const user = await requireUser();

  const [snapshot, expenseList, activeProjects, pendingUsers, recentActivity] = await Promise.all([
    computeSplits(),
    db.select().from(expenses).orderBy(desc(expenses.date)),
    db.select().from(projects).where(eq(projects.status, "active")).orderBy(desc(projects.createdAt)),
    // Registration requests are superadmin view only (phases-plan 5.3 /
    // Client-Requests.md), so regular users never even fetch this list.
    user.role === "superadmin"
      ? db
          .select({
            id: users.id,
            firstName: users.firstName,
            middleName: users.middleName,
            lastName: users.lastName,
            suffix: users.suffix,
          })
          .from(users)
          .where(eq(users.status, "pending"))
      : Promise.resolve([]),
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

  const registrations: PendingRegistration[] = pendingUsers.map((pendingUser) => ({
    id: pendingUser.id,
    fullName: [pendingUser.firstName, pendingUser.middleName, pendingUser.lastName, pendingUser.suffix]
      .filter(Boolean)
      .join(" "),
  }));

  // Not-yet-earned milestones across every active project — surfaced in
  // the compact split row (BudgetSection) as "what's left to earn",
  // reusing allMilestones instead of a separate query.
  const pendingMilestones = allMilestones.filter((m) => m.status !== "completed");
  const pendingMilestoneCount = pendingMilestones.length;
  const pendingMilestonesTotal = pendingMilestones
    .reduce((sum, m) => sum + Number(m.price), 0)
    .toFixed(2);

  // "Finished milestones with no invoice or AR made yet" (5.3) is broader
  // than 5.2's AR-pending badge: it fires on a missing invoice too, not
  // just a missing AR (either document type counts as the milestone
  // having been actioned), and now surfaces per milestone rather than per
  // project, since a project can have several finished milestones each
  // still needing their own billing document.
  const milestonesAwaitingDocument: MilestoneAwaitingDocument[] = activeProjects.flatMap((project) => {
    const projectMilestones = allMilestones.filter((m) => m.projectId === project.id);
    const projectDocs = allDocuments.filter((doc) => doc.projectId === project.id);
    return projectMilestones
      .filter((m) => {
        if (m.status !== "completed") return false;
        return !projectDocs.some((doc) => doc.milestoneId === m.id);
      })
      .map((m) => ({ id: project.id, title: project.title, milestone: m.title }));
  });

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 overflow-hidden px-6 pb-10">
        {/* Header shares the same max-width container and side padding as
            the card grid below, so the logo/subtitle align with the
            grid's left edge and the profile menu aligns with its right
            edge instead of tracking the viewport edges independently. */}
        <div className="flex shrink-0 items-center justify-between gap-4 pt-10 pb-4">
          <div className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- static
                brand asset from /public, not a next/image candidate */}
            <img src="/qula-logo.svg" alt="Qula" className="h-8 w-auto self-start" />
            <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
              Internal Management System
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationMenu
              registrations={registrations}
              milestonesAwaitingDocument={milestonesAwaitingDocument}
            />
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
            left column (row-span-2, 1x2) now that pending actions has
            moved to the header notification menu — active projects and
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
