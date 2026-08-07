import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProjectDetail } from "@/lib/projects/queries";
import { MilestonesSection } from "@/app/projects/[id]/milestones-section";
import { ProjectModal } from "@/app/projects/[id]/project-modal";

// Intercepting route for /projects/[id]. The (.) segment tells Next.js to
// swap this in for the real route ONLY when navigation starts from a
// sibling route inside app/ (i.e. from a <Link> click on the dashboard,
// notification menu, or projects list) — the underlying page stays
// mounted and this renders into the @modal slot on top of it, which is
// what actually gives the modal a background instead of nothing. Direct
// loads and refreshes skip this file entirely and hit the plain
// app/projects/[id]/page.tsx instead. Logic here is intentionally
// identical to that fallback page — same data, same modal wrapper — so
// the two are visually indistinguishable, they just differ in whether
// something is mounted behind them.
export default async function InterceptedProjectDetailPage({
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
