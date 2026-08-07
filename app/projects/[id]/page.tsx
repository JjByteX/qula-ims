import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getOrCreateAppSettings } from "@/lib/settings/get";
import { db } from "@/db/client";
import { milestones, projectDocuments, projects } from "@/db/schema";
import { ProjectDocumentsSection } from "./project-documents-section";
import { MilestonesSection } from "./milestones-section";
import { CURRENCY_SYMBOL, formatCurrency } from "@/lib/currency";

// Invoice/AR live on the project page (Client-Requests.md: "Lives on the
// same page as Projects, directly connected"), so this fetches both in
// one page load rather than the documents list being a separate route.
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) {
    notFound();
  }

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

  // Notification lead time (phases-plan 6.1), applied here to flag
  // invoices due soon — see lib/documents/due-soon.ts.
  const settings = await getOrCreateAppSettings();

  // Total price is the sum of the project's milestones — not a stored
  // field, so it can never drift from what the milestones actually add
  // up to (same reasoning as the API's GET /api/projects computed sum).
  const totalPrice = projectMilestones
    .reduce((sum, m) => sum + Number(m.price), 0)
    .toFixed(2);

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
            {project.title}
            {project.status === "archived" && (
              <span className="ml-2 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                Archived
              </span>
            )}
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            {projectMilestones.length} {projectMilestones.length === 1 ? "milestone" : "milestones"}{" "}
            · {CURRENCY_SYMBOL}
            {formatCurrency(totalPrice)}
          </p>
        </div>

        <MilestonesSection
          projectId={project.id}
          initialMilestones={projectMilestones}
          documents={documents}
        />

        <ProjectDocumentsSection
          project={project}
          milestones={projectMilestones}
          initialDocuments={documents}
          notificationDaysBefore={settings.notificationDaysBefore}
        />
      </div>
    </main>
  );
}
