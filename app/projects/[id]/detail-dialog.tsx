"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Used only by the plain /projects/[id] page (app/projects/[id]/page.tsx)
// — the fallback for direct visits, refreshes, and bookmarks, as opposed
// to the popup opened from the dashboard/list/notifications (see
// app/projects/milestones-dialog.tsx). This page is always a fresh full
// load, never something the person "returns to" via Back, so closing it
// is just an ordinary navigation to /projects — no history juggling
// needed.
export function ProjectDetailDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={(next) => !next && router.push("/projects")}>
      <DialogContent className="p-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Project milestones</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
