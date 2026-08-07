import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProjectDetail } from "@/lib/projects/queries";
import { MilestonesSection } from "./milestones-section";
import { ProjectModal } from "./project-modal";

// Milestones (Client-Requests.md / phases-plan 3.1/3.4) has no page of its
// own — the card in MilestonesSection is the only content this route ever
// renders, and it always renders as a centered modal over whatever page
// linked here (dashboard "Active projects", the notification menu, or the
// projects list itself), never as a full page. Rendering the modal here in
// the page component — rather than only via an intercepting route — means
// every entry point gets the modal, including links from outside
// /projects, and a refresh while the modal is open lands on the same
// modal-over-nothing instead of a bare page.
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
    <ProjectModal>
      <MilestonesSection
        projectId={project.id}
        projectTitle={project.title}
        projectStatus={project.status}
        initialMilestones={milestones}
        documents={documents}
      />
    </ProjectModal>
  );
}
