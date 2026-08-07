import { asc, desc, eq, sql } from "drizzle-orm";
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
