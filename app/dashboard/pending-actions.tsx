import Link from "next/link";
import { UserPlus, FileWarning } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type PendingRegistration = {
  id: string;
  fullName: string;
};

export type MilestoneAwaitingDocument = {
  id: string;
  title: string;
  milestone: string;
};

// Pending actions (phases-plan 5.3 / Client-Requests.md "Registration
// requests waiting on superadmin (superadmin view only) ... Finished
// milestones with no invoice or AR made yet"). Two distinct fact sources,
// but both are "things someone still needs to do" — same concept, so per
// the card-fragmentation rule in ux-ui-guidelines.md they share one card
// with two short lists rather than being split into separate cards.
//
// registrations is passed as an empty array for non-superadmins (see
// page.tsx) rather than this component checking role itself — the page
// already knows the role from requireUser(), no need for a second source
// of truth here. When empty for a regular user, that half of the card
// just doesn't render, same as when there happen to be no pending
// registrations for a superadmin.
export function PendingActions({
  registrations,
  milestonesAwaitingDocument,
}: {
  registrations: PendingRegistration[];
  milestonesAwaitingDocument: MilestoneAwaitingDocument[];
}) {
  const isEmpty = registrations.length === 0 && milestonesAwaitingDocument.length === 0;

  return (
    <Card className="rounded-[var(--radius-lg)]">
      <CardContent className="flex flex-col gap-4 p-6">
        <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
          Pending actions
        </span>

        {isEmpty ? (
          <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
            Nothing pending.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {registrations.map((registration) => (
              <Link
                key={registration.id}
                href="/users/pending"
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-[var(--muted)]"
              >
                <UserPlus
                  className="size-4 shrink-0 text-[var(--muted-foreground)]"
                  aria-hidden="true"
                />
                <span className="text-[var(--text-base)] text-[var(--foreground)]">
                  {registration.fullName} requested an account
                </span>
              </Link>
            ))}

            {milestonesAwaitingDocument.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-[var(--muted)]"
              >
                <FileWarning
                  className="size-4 shrink-0 text-[var(--muted-foreground)]"
                  aria-hidden="true"
                />
                <span className="text-[var(--text-base)] text-[var(--foreground)]">
                  {project.title} finished "{project.milestone}" with no invoice or AR
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
