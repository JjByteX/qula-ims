import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProjectDetail } from "@/lib/projects/queries";
import { MilestonesSection } from "./milestones-section";
import { ProjectDetailDialog } from "./detail-dialog";

// Milestones (Client-Requests.md / phases-plan 3.1/3.4) has no page of its
// own — the card in MilestonesSection is the only content this route ever
// renders. Direct visits, refreshes, and bookmarks land here and see it
// in a plain dialog (ProjectDetailDialog). Every other entry point
// (dashboard, projects list, notification menu) opens the same
// MilestonesSection content through the client-side popup instead — see
// app/projects/milestones-dialog.tsx — so this route is purely a
// fallback, not the thing those links point at.
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const detail = await getProjectDetail(id);
  if (!detail) {
    notFound();
  }
  const { project, milestones, documents } = detail;

  return (
    <ProjectDetailDialog>
      <MilestonesSection
        projectId={project.id}
        projectTitle={project.title}
        projectStatus={project.status}
        initialMilestones={milestones}
        documents={documents}
      />
    </ProjectDetailDialog>
  );
}

