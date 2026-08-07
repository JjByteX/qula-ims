"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Lets content rendered inside ProjectModal (MilestonesSection) dismiss
// the dialog itself before navigating somewhere that isn't the
// intercepted /projects/[id] route. Plain router.push() to e.g.
// /projects/[id]/documents/[docId] swaps the main slot but doesn't touch
// @modal — that slot keeps whatever it last matched (this modal) mounted,
// so without calling dismiss() first the dialog is left open on top of
// the new page. Defaults to a no-op so MilestonesSection can call it
// unconditionally even outside a ProjectModal.
const ProjectModalDismissContext = createContext<() => void>(() => {});

export function useProjectModalDismiss() {
  return useContext(ProjectModalDismissContext);
}

// Renders the project detail route as a centered modal instead of a full
// page, no matter how /projects/[id] was reached. Closing (Esc, overlay
// click, or the X in DialogContent) goes back in history when there is
// somewhere to go back to (the common case: clicked from dashboard,
// notifications, or the projects list), and otherwise falls back to
// /projects — covers opening the link directly or in a new tab, where
// router.back() would leave the modal open with nothing behind it.
export function ProjectModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function close() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/projects");
    }
  }

  // Used when navigating forward to a non-intercepted route (e.g. a
  // milestone's Invoice/AR page) rather than dismissing the modal back to
  // where it came from — just hides the dialog immediately without
  // touching history, since router.push right after will handle getting
  // to the right URL.
  function dismiss() {
    setOpen(false);
  }

  return (
    <ProjectModalDismissContext.Provider value={dismiss}>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
        }}
      >
        <DialogContent className="p-0" aria-describedby={undefined}>
          {/* Visually hidden title for accessibility; the project title inside
              MilestonesSection is the visible heading. */}
          <DialogTitle className="sr-only">Project milestones</DialogTitle>
          {children}
        </DialogContent>
      </Dialog>
    </ProjectModalDismissContext.Provider>
  );
}
