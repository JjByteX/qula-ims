import { requireUser } from "@/lib/auth/session";
import { getProjectsWithComputedPrice } from "@/lib/projects/queries";
import { ProjectsSection } from "./projects-section";

// Any signed-in user can view and edit projects (phases-plan 3.1 /
// Client-Requests.md — same open-edit rule as budget). Only active
// projects load on first paint; ProjectsSection fetches archived ones
// itself if the person switches views, so the common case (checking
// what's ongoing) doesn't pay for data nobody's looking at yet.
export default async function ProjectsPage() {
  await requireUser();

  const activeProjects = await getProjectsWithComputedPrice("active");

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
            Projects
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            Each project can have several milestones — add its first one now, and
            more later from the project page.
          </p>
        </div>

        <ProjectsSection initialProjects={activeProjects} />
      </div>
    </main>
  );
}
