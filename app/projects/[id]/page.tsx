import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { projectDocuments, projects } from "@/db/schema";
import { ProjectDocumentsSection } from "./project-documents-section";
import { MilestoneStatus } from "./milestone-status";

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

  const documents = await db
    .select()
    .from(projectDocuments)
    .where(eq(projectDocuments.projectId, id))
    .orderBy(desc(projectDocuments.createdAt));

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
            {project.milestone} · ₱
            {new Intl.NumberFormat("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(Number(project.price))}
          </p>
        </div>

        <MilestoneStatus project={project} documents={documents} />

        <ProjectDocumentsSection project={project} initialDocuments={documents} />
      </div>
    </main>
  );
}
