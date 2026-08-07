"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MilestonesSection } from "@/app/projects/[id]/milestones-section";
import type { Milestone, Project, ProjectDocument } from "@/db/schema";

// Replaces the old /projects/[id] "intercepting route" modal
// (app/@modal/(.)projects/[id] + project-modal.tsx). That approach made
// the popup a side effect of routing: opening it meant navigating to a
// URL, and Next.js only reliably renders that URL as a popup when you
// arrive via a same-app link click, not on browser Back/Forward. Every
// time the popup needed to lead somewhere else (the invoice page) and
// then come back, that arrival condition broke in a different way —
// showing the wrong page, or freezing.
//
// This version has no URL of its own and doesn't touch history at all.
// It's just: a boolean (is a project selected?) and a fetch. Click a
// project -> setOpenProjectId(id) -> dialog opens and fetches that
// project's data. Click Invoice inside it -> plain router.push to the
// invoice page, dialog just closes like any dialog would. Click Back on
// the invoice page -> ordinary browser history, lands wherever you were
// before, dialog stays closed (nothing forces it back open, since
// nothing ever tied it to a URL to "restore"). That's the tradeoff for
// dropping the routing trick: getting back to the same open milestone
// list is one extra click, but every navigation in and out of it is
// plain, predictable browser behavior instead of a routing edge case.

type ProjectDetail = {
  project: Project;
  milestones: Milestone[];
  documents: ProjectDocument[];
};

const MilestonesDialogContext = createContext<{
  openProject: (id: string) => void;
} | null>(null);

// Used by the dashboard, projects list, and notification menu — anywhere
// that used to be a <Link href={`/projects/${id}`}> relying on
// interception. Those become a click handler calling openProject(id)
// instead of a navigation.
export function useMilestonesDialog() {
  const ctx = useContext(MilestonesDialogContext);
  if (!ctx) {
    throw new Error("useMilestonesDialog must be used within MilestonesDialogProvider");
  }
  return ctx;
}

// Mounted once, high up (root layout), so any page can open the dialog
// without prop-drilling. Owns the fetch and the open/closed state;
// MilestonesSection itself is unchanged in what it renders, just no
// longer fed by a server-rendered page.
export function MilestonesDialogProvider({ children }: { children: React.ReactNode }) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openProject = useCallback((id: string) => {
    setOpenProjectId(id);
    setDetail(null);
    setError(null);
    fetch(`/api/projects/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Couldn't load this project.");
        }
        return res.json();
      })
      .then((data: ProjectDetail) => setDetail(data))
      .catch((err: Error) => setError(err.message || "Couldn't load this project."));
  }, []);

  function close() {
    setOpenProjectId(null);
    setDetail(null);
    setError(null);
  }

  return (
    <MilestonesDialogContext.Provider value={{ openProject }}>
      {children}
      <Dialog open={openProjectId !== null} onOpenChange={(next) => !next && close()}>
        <DialogContent className="p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Project milestones</DialogTitle>
          {error && (
            <p className="p-6 text-[var(--text-sm)] text-[var(--destructive)]">{error}</p>
          )}
          {!error && !detail && (
            <p className="p-6 text-[var(--text-sm)] text-[var(--muted-foreground)]">
              Loading...
            </p>
          )}
          {detail && (
            <MilestonesSection
              projectId={detail.project.id}
              projectTitle={detail.project.title}
              projectStatus={detail.project.status}
              initialMilestones={detail.milestones}
              documents={detail.documents}
              onNavigateAway={close}
            />
          )}
        </DialogContent>
      </Dialog>
    </MilestonesDialogContext.Provider>
  );
}
