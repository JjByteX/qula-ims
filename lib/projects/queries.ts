import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { milestones, projects } from "@/db/schema";

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
