"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { CURRENCY_SYMBOL, formatCurrency } from "@/lib/currency";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMilestonesDialog } from "@/app/projects/milestones-dialog";

export type ActiveProjectRow = {
  id: string;
  title: string;
  milestoneCount: number;
  completedMilestoneCount: number;
  price: string;
  hasUnpaidInvoice: boolean;
  arPending: boolean;
  nextMilestone?: { title: string; price: string };
};

// Active projects (phases-plan 5.2 / Client-Requests.md "Active projects
// ... Flags any with an unpaid invoice or pending AR"). One card holding
// the whole list, same shape as BudgetSection (5.1) — this is one
// logical section, so per the card-fragmentation rule in
// ux-ui-guidelines.md each project row lives inside the section's single
// card rather than getting its own. The card links to /projects
// (phases-plan 5.5), and each row links straight to its project detail
// page since that's the more useful destination once the person has
// already spotted the one they want.
export function ActiveProjects({ projects }: { projects: ActiveProjectRow[] }) {
  const { openProject } = useMilestonesDialog();

  return (
    <Card className="flex h-full min-h-0 flex-col rounded-[var(--radius-sm)]">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <Link href="/projects" className="flex shrink-0 items-center justify-between gap-4">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Active projects
          </span>
        </Link>

        {projects.length === 0 ? (
          <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
            No active projects yet.
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col divide-y divide-[var(--border-soft)] overflow-y-auto">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => openProject(project.id)}
                className="flex items-center justify-between gap-4 py-3 text-left first:pt-0 last:pb-0 hover:bg-[var(--muted)]"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--text-base)] text-[var(--foreground)]">
                      {project.title}
                    </span>
                    <span className="text-[var(--text-base)] font-semibold text-[var(--foreground)]">
                      {CURRENCY_SYMBOL}
                      {formatCurrency(project.price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                      {project.completedMilestoneCount}/{project.milestoneCount}{" "}
                      {project.milestoneCount === 1 ? "milestone" : "milestones"}
                    </span>
                    {project.nextMilestone && (
                      <span className="flex items-center gap-1.5 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                        <span aria-hidden="true">•</span>
                        Next: {project.nextMilestone.title} ({CURRENCY_SYMBOL}
                        {formatCurrency(project.nextMilestone.price)})
                      </span>
                    )}
                  </div>
                </div>
                {(project.hasUnpaidInvoice || project.arPending) && (
                  <div className="flex shrink-0 items-center gap-2">
                    {project.hasUnpaidInvoice && (
                      <Badge variant="destructive">
                        <AlertCircle className="size-3" aria-hidden="true" />
                        Unpaid invoice
                      </Badge>
                    )}
                    {project.arPending && (
                      <Badge variant="destructive">
                        <AlertCircle className="size-3" aria-hidden="true" />
                        AR pending
                      </Badge>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
