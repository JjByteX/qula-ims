import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { milestones, projectDocuments, projects } from "@/db/schema";

// Shared by the projects list page and GET /api/projects (used when
// toggling "show archived") so both ever compute price the same way — a
// project's price is never stored, only ever the sum of its milestones'
// prices (db/schema/projects.ts), and that sum needs to be computed
// identically wherever a project list is rendered.
export async function getProjectsWithComputedPrice(status: "active" | "archived" | "all") {
  const priceSum = sql<string>`coalesce(sum(${milestones.price}), 0)`.as("price");

  const query = db
    .select({
      id: projects.id,
      title: projects.title,
      status: projects.status,
      billedToName: projects.billedToName,
      billedToAttention: projects.billedToAttention,
      createdByUserId: projects.createdByUserId,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      price: priceSum,
    })
    .from(projects)
    .leftJoin(milestones, eq(milestones.projectId, projects.id))
    .groupBy(projects.id)
    .orderBy(desc(projects.createdAt));

  return status === "all" ? query : query.where(eq(projects.status, status));
}

export type ProjectListRow = {
  id: string;
  title: string;
  status: "active" | "archived";
  billedToName: string | null;
  billedToAttention: string | null;
  price: string;
  milestoneCount: number;
  completedMilestoneCount: number;
  nextMilestone?: { title: string; price: string };
  hasUnpaidInvoice: boolean;
  arPending: boolean;
};

// Same row shape as app/dashboard/page.tsx's projectRows (milestone
// count, next milestone, unpaid-invoice/AR-pending flags) — the projects
// page table shows the same columns the dashboard's Active Projects card
// already computes, just for every project (not just active ones) and
// as its own page instead of a card. Kept here rather than inlined in
// page.tsx for the same "one definition of how a project list is
// loaded" reason getProjectsWithComputedPrice already documents, and
// reused by GET /api/projects too so the "Show archived" client refetch
// gets the same columns as first paint.
export async function getProjectsListRows(
  status: "active" | "archived" | "all",
): Promise<ProjectListRow[]> {
  const projectRows =
    status === "all"
      ? await db.select().from(projects).orderBy(desc(projects.createdAt))
      : await db
          .select()
          .from(projects)
          .where(eq(projects.status, status))
          .orderBy(desc(projects.createdAt));

  if (projectRows.length === 0) return [];

  const projectIds = projectRows.map((p) => p.id);
  const [allMilestones, allDocuments] = await Promise.all([
    db.select().from(milestones).where(inArray(milestones.projectId, projectIds)),
    db.select().from(projectDocuments).where(inArray(projectDocuments.projectId, projectIds)),
  ]);

  return projectRows.map((project) => {
    const projectMilestones = allMilestones.filter((m) => m.projectId === project.id);
    const projectDocs = allDocuments.filter((doc) => doc.projectId === project.id);
    const hasUnpaidInvoice = projectDocs.some((doc) => doc.type === "invoice" && !doc.isPaid);

    const arPending = projectMilestones.some((m) => {
      if (m.status !== "completed") return false;
      return !projectDocs.some((doc) => doc.milestoneId === m.id && doc.type === "ar");
    });

    const totalPrice = projectMilestones.reduce((sum, m) => sum + Number(m.price), 0).toFixed(2);
    const completedMilestoneCount = projectMilestones.filter(
      (m) => m.status === "completed",
    ).length;

    const nextMilestone = projectMilestones
      .filter((m) => m.status === "pending")
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))[0];

    return {
      id: project.id,
      title: project.title,
      status: project.status,
      billedToName: project.billedToName,
      billedToAttention: project.billedToAttention,
      price: totalPrice,
      milestoneCount: projectMilestones.length,
      completedMilestoneCount,
      nextMilestone: nextMilestone
        ? { title: nextMilestone.title, price: nextMilestone.price }
        : undefined,
      hasUnpaidInvoice,
      arPending,
    };
  });
}

// Single project + its milestones + its documents, for the milestone card
// (app/projects/[id]/page.tsx). The milestone card is the only content
// /projects/[id] ever renders — always as a modal over whichever page
// linked to it (dashboard, notifications, or the projects list) — so
// there's exactly one place that needs this fetch, but it's kept as its
// own function rather than inlined in the page for the same reason as
// getProjectsWithComputedPrice above: one definition of "how a project's
// detail is loaded" instead of the fetch being re-derived anywhere else
// that ever needs it (e.g. a future metadata/head export on the same
// route).
export async function getProjectDetail(id: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) return null;

  const [projectMilestones, documents] = await Promise.all([
    db
      .select()
      .from(milestones)
      .where(eq(milestones.projectId, id))
      .orderBy(asc(milestones.sortOrder), asc(milestones.createdAt)),
    db
      .select()
      .from(projectDocuments)
      .where(eq(projectDocuments.projectId, id))
      .orderBy(desc(projectDocuments.createdAt)),
  ]);

  return { project, milestones: projectMilestones, documents };
}
