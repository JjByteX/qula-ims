"use client";

import Link from "next/link";
import { Bell, UserPlus, FileWarning } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMilestonesDialog } from "@/app/projects/milestones-dialog";

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
// milestones with no invoice or AR made yet") — moved from its own
// dashboard card into a header notification menu, next to ProfileMenu,
// so the split/active-projects cards can use the vertical space that
// card used to occupy. Same two fact sources as before, same one-list
// grouping (still "things someone still needs to do"), just surfaced
// through a bell trigger instead of an always-visible card.
//
// registrations is passed as an empty array for non-superadmins (see
// page.tsx) rather than this component checking role itself — the page
// already knows the role from requireUser(), no need for a second source
// of truth here.
export function NotificationMenu({
  registrations,
  milestonesAwaitingDocument,
}: {
  registrations: PendingRegistration[];
  milestonesAwaitingDocument: MilestoneAwaitingDocument[];
}) {
  const { openProject } = useMilestonesDialog();
  const totalCount = registrations.length + milestonesAwaitingDocument.length;
  const isEmpty = totalCount === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            isEmpty
              ? "Pending actions, nothing pending"
              : `Pending actions, ${totalCount} ${totalCount === 1 ? "item" : "items"}`
          }
          className="relative flex size-9 items-center justify-center rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        >
          <Bell className="size-5 text-[var(--foreground)]" aria-hidden="true" />
          {!isEmpty && (
            <span
              className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-[var(--destructive)] text-[10px] font-semibold leading-none text-[var(--destructive-foreground)]"
              aria-hidden="true"
            >
              {totalCount > 9 ? "9+" : totalCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex flex-col gap-1 p-4">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Pending actions
          </span>

          {isEmpty ? (
            <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
              Nothing pending.
            </p>
          ) : (
            <div className="flex max-h-[360px] flex-col divide-y divide-[var(--border-soft)] overflow-y-auto">
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
                <button
                  key={`${project.id}:${project.milestone}`}
                  type="button"
                  onClick={() => openProject(project.id)}
                  className="flex items-center gap-3 py-3 text-left first:pt-0 last:pb-0 hover:bg-[var(--muted)]"
                >
                  <FileWarning
                    className="size-4 shrink-0 text-[var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                  <span className="text-[var(--text-base)] text-[var(--foreground)]">
                    {project.title} finished "{project.milestone}" with no invoice or AR
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
