import { desc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { computeSplits } from "@/lib/budget/compute";
import { db } from "@/db/client";
import { activityLog, expenses, milestones, projectDocuments, projects, users } from "@/db/schema";
import { BudgetSection } from "./budget-section";
import { ActiveProjects, type ActiveProjectRow } from "./active-projects";
import {
  PendingActions,
  type MilestoneAwaitingDocument,
  type PendingRegistration,
} from "./pending-actions";
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
// total, and split are one logical concept. Active projects (5.2),
// pending actions (5.3), and recent activity (5.4) fill out the rest.
// Navigation (5.5) is satisfied by each section already linking to its
// full page — no separate component needed for that phase.
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

    return {
      id: project.id,
      title: project.title,
      milestoneCount: projectMilestones.length,
      price: totalPrice,
      hasUnpaidInvoice,
      arPending,
    };
  });

  const registrations: PendingRegistration[] = pendingUsers.map((pendingUser) => ({
    id: pendingUser.id,
    fullName: [pendingUser.firstName, pendingUser.middleName, pendingUser.lastName, pendingUser.suffix]
      .filter(Boolean)
      .join(" "),
  }));

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
    <main className="min-h-screen bg-[var(--background)] px-6 py-10">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- static
                brand asset from /public, not a next/image candidate */}
            <img src="/qula-logo.svg" alt="Qula" className="h-8 w-auto" />
            <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
              Internal Management System
            </p>
          </div>
          <ProfileMenu
            user={{
              firstName: user.firstName,
              lastName: user.lastName,
              profilePictureUrl: user.profilePictureUrl,
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BudgetSection
            initialAllocatedFunds={allocatedFunds}
            initialExpenses={expenseList}
            initialSplitterState={snapshot}
          />
          <ActiveProjects projects={projectRows} />
          <PendingActions
            registrations={registrations}
            milestonesAwaitingDocument={milestonesAwaitingDocument}
          />
          <RecentActivity entries={recentActivity} />
        </div>
      </div>
    </main>
  );
}
