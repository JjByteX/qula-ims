import { requireUser } from "@/lib/auth/session";
import { getProjectsListRows } from "@/lib/projects/queries";
import { ProjectsSection } from "./projects-section";
import { ProfileMenu } from "@/app/dashboard/profile-menu";

// Any signed-in user can view and edit projects (phases-plan 3.1 /
// Client-Requests.md — same open-edit rule as budget). Only active
// projects load on first paint; ProjectsSection fetches archived ones
// itself if the person switches views, so the common case (checking
// what's ongoing) doesn't pay for data nobody's looking at yet.
export default async function ProjectsPage() {
  const currentUser = await requireUser();

  const activeProjects = await getProjectsListRows("active");

  return (
    // Same fit-to-viewport shape as app/dashboard/page.tsx: h-screen +
    // overflow-hidden on main, so the page itself never scrolls — only
    // the table body does (min-h-0 on the flex chain plus overflow-y-auto
    // on the table's own scroll area in ProjectsSection), same reasoning
    // as the dashboard's per-card scroll areas.
    <main className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 overflow-hidden px-6 pb-10">
        <div className="flex shrink-0 items-center justify-between gap-4 pt-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- static
              brand asset from /public, not a next/image candidate */}
          <a href="/dashboard" aria-label="Go to dashboard">
            <img src="/qula-logo.svg" alt="Qula" className="h-8 w-auto self-start" />
          </a>
          <ProfileMenu
            user={{
              firstName: currentUser.firstName,
              lastName: currentUser.lastName,
              profilePictureUrl: currentUser.profilePictureUrl,
            }}
          />
        </div>

        <ProjectsSection initialProjects={activeProjects} />
      </div>
    </main>
  );
}
