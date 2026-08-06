"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Project, ProjectDocument } from "@/db/schema";

// Status tracking (phases-plan 3.4): surfaces both halves of "Finished
// milestones with no invoice or AR made yet" (Client-Requests.md) right
// on the project page — milestoneCompleted is the fact, and the
// AR-pending badge is computed from it plus whether an AR document
// already exists for this project. Dashboard (phase 5) will aggregate
// this same fact across projects; this is the per-project source of it.
export function MilestoneStatus({
  project,
  documents,
}: {
  project: Project;
  documents: ProjectDocument[];
}) {
  const router = useRouter();
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAr = documents.some((doc) => doc.type === "ar");
  const arPending = project.milestoneCompleted && !hasAr;

  async function handleToggle() {
    setIsToggling(true);
    setError(null);
    try {
      const action = project.milestoneCompleted ? "reopen-milestone" : "complete-milestone";
      const res = await fetch(`/api/projects/${project.id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={project.milestoneCompleted ? "success" : "outline"}>
          {project.milestoneCompleted ? "Milestone complete" : "Milestone in progress"}
        </Badge>
        {arPending && (
          <Badge variant="destructive">
            <AlertCircle className="size-3" aria-hidden="true" />
            AR pending
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={handleToggle} disabled={isToggling}>
          {project.milestoneCompleted ? (
            <CircleX className="size-4" aria-hidden="true" />
          ) : (
            <CircleCheck className="size-4" aria-hidden="true" />
          )}
          {isToggling
            ? "Updating..."
            : project.milestoneCompleted
              ? "Reopen milestone"
              : "Mark milestone complete"}
        </Button>
      </div>
      {error && <p className="text-[var(--text-sm)] text-[var(--destructive)]">{error}</p>}
    </div>
  );
}
