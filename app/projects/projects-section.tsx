"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Archive, ArchiveRestore, Save, X, ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  projectSchema,
  milestoneSchema,
  type ProjectInput,
} from "@/lib/validation/projects";
import { CURRENCY_SYMBOL, formatCurrency } from "@/lib/currency";
import { useMilestonesDialog } from "@/app/projects/milestones-dialog";
import useAutoTableRows from "@/lib/hooks/useAutoTableRows";

type Project = {
  id: string;
  title: string;
  price: string;
  status: "active" | "archived";
  billedToName?: string | null;
  billedToAttention?: string | null;
  milestoneCount: number;
  completedMilestoneCount: number;
  nextMilestone?: { title: string; price: string };
  hasUnpaidInvoice: boolean;
  arPending: boolean;
};

// Create form: title + its first milestone (title, price) in one step —
// the common case is a project starting with at least one billable stage
// (Client-Requests.md "Enter Project", revised for multi-milestone
// projects), so this avoids a separate "now add a milestone" step
// immediately after every create. More milestones can be added
// afterward from the project's own page
// (app/projects/[id]/milestones-section.tsx).
const createProjectSchema = projectSchema.extend({ milestone: milestoneSchema });
type CreateProjectInput = z.infer<typeof createProjectSchema>;

function CreateProjectForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: CreateProjectInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      milestone: { title: "", price: "" },
      billedToName: "",
      billedToAttention: "",
    },
  });

  async function submit(data: CreateProjectInput) {
    setServerError(null);
    try {
      await onSubmit(data);
    } catch {
      setServerError("Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Project title</Label>
        <Input id="title" aria-invalid={!!errors.title} {...register("title")} />
        {errors.title && (
          <p className="text-[var(--text-sm)] text-[var(--destructive)]">{errors.title.message}</p>
        )}
      </div>

      {/* Billed To / Attention (docs/phases-plan-revision-2.md Phase 13)
          sit right under the project title — every project has a
          client, so Billed To is required, on the same visual tier as
          the title. This also matches where the value shows up on the
          generated invoice/AR itself: under the document title. Attention
          stays optional — a specific contact person isn't always known
          yet. Payment info (method/account/bank/number) isn't asked for
          here at all — that's the designated payer's own profile,
          selected once in Settings (docs/phases-plan-revision-2.md
          Phase 14), not a per-project field. */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="billedToName">Billed To (company)</Label>
          <Input
            id="billedToName"
            aria-invalid={!!errors.billedToName}
            {...register("billedToName")}
          />
          {errors.billedToName && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">
              {errors.billedToName.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="billedToAttention">Attention (contact person)</Label>
          <Input id="billedToAttention" {...register("billedToAttention")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone.title">First milestone</Label>
          <Input
            id="milestone.title"
            aria-invalid={!!errors.milestone?.title}
            {...register("milestone.title")}
          />
          {errors.milestone?.title && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">
              {errors.milestone.title.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone.price">Price</Label>
          <Input
            id="milestone.price"
            inputMode="decimal"
            aria-invalid={!!errors.milestone?.price}
            {...register("milestone.price")}
          />
          {errors.milestone?.price && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">
              {errors.milestone.price.message}
            </p>
          )}
        </div>
      </div>

      {serverError && (
        <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!isValid || isSubmitting}>
          <Save className="size-4" aria-hidden="true" />
          {isSubmitting ? "Saving..." : "Add"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
            <X className="size-4" aria-hidden="true" />
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

// Edit form: title only. Milestones (each with their own title/price) are
// edited on the project's own page now that a project can have more than
// one.
function EditProjectForm({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues: ProjectInput;
  onSubmit: (data: ProjectInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    mode: "onChange",
    defaultValues,
  });

  async function submit(data: ProjectInput) {
    setServerError(null);
    try {
      await onSubmit(data);
    } catch {
      setServerError("Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-title">Project title</Label>
        <Input id="edit-title" aria-invalid={!!errors.title} {...register("title")} />
        {errors.title && (
          <p className="text-[var(--text-sm)] text-[var(--destructive)]">{errors.title.message}</p>
        )}
      </div>

      {/* Billed To / Attention (docs/phases-plan-revision-2.md Phase 13)
          — under the project title. Billed To is required, same tier as
          the title. Attention stays optional. Payment info isn't edited
          here — that's the designated payer's own profile in Settings
          (Phase 14). */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-billedToName">Billed To (company)</Label>
          <Input
            id="edit-billedToName"
            aria-invalid={!!errors.billedToName}
            {...register("billedToName")}
          />
          {errors.billedToName && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">
              {errors.billedToName.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-billedToAttention">Attention (contact person)</Label>
          <Input id="edit-billedToAttention" {...register("billedToAttention")} />
        </div>
      </div>

      {serverError && (
        <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!isValid || isSubmitting}>
          <Save className="size-4" aria-hidden="true" />
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
            <X className="size-4" aria-hidden="true" />
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function ProjectsSection({ initialProjects }: { initialProjects: Project[] }) {
  const { openProject } = useMilestonesDialog();
  const [projects, setProjects] = useState(initialProjects);
  const [showArchived, setShowArchived] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [hasLoadedArchived, setHasLoadedArchived] = useState(false);

  async function handleCreate(data: CreateProjectInput) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Something went wrong.");
    }
    const { project } = await res.json();
    // Freshly created project has one milestone and nothing billed yet
    // — same shape the table columns below expect, filled in directly
    // rather than round-tripping through GET /api/projects again.
    setProjects((prev) => [
      {
        ...project,
        milestoneCount: 1,
        completedMilestoneCount: 0,
        nextMilestone: { title: data.milestone.title, price: data.milestone.price },
        hasUnpaidInvoice: false,
        arPending: false,
      },
      ...prev,
    ]);
    setIsAddOpen(false);
  }

  async function handleUpdate(id: string, data: ProjectInput) {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Something went wrong.");
    }
    const { project } = await res.json();
    // The PATCH response doesn't recompute price (it only touches title),
    // so merge rather than replace to keep the row's already-known price.
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...project } : p)));
    setEditingId(null);
  }

  async function handleArchiveToggle(project: Project) {
    setArchivingId(project.id);
    setRowError(null);
    try {
      const action = project.status === "active" ? "archive" : "unarchive";
      const res = await fetch(`/api/projects/${project.id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setRowError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      const { project: updated } = await res.json();
      if (showArchived) {
        // Both statuses are visible in this view — just reflect the new
        // status in place rather than removing the row. Same
        // merge-not-replace reasoning as handleUpdate above.
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      } else {
        // Only active projects are visible here, so the only action
        // reachable in this view is archiving — remove the row once it
        // is archived. (Unarchive only ever renders when showArchived
        // is true, in the branch above.)
        setProjects((prev) => prev.filter((p) => p.id !== updated.id));
      }
    } catch {
      setRowError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setArchivingId(null);
    }
  }

  async function toggleShowArchived() {
    const next = !showArchived;
    setShowArchived(next);
    if (next && !hasLoadedArchived) {
      setIsLoadingArchived(true);
      try {
        const res = await fetch("/api/projects?status=all");
        if (res.ok) {
          const { projects: all } = await res.json();
          setProjects(all);
          setHasLoadedArchived(true);
        }
      } finally {
        setIsLoadingArchived(false);
      }
    } else if (!next) {
      setProjects((prev) => prev.filter((p) => p.status === "active"));
    }
  }

  const visibleProjects = showArchived ? projects : projects.filter((p) => p.status === "active");

  // Auto-fit pagination (ported from amkor-ims's DataTable/useAutoPageSize):
  // the table measures its own available height and computes how many rows
  // fit, instead of scrolling internally — a row that doesn't fit the
  // viewport moves to the next page rather than being clipped or forcing a
  // scrollbar.
  const { containerRef: tableCardRef, rowsPerPage } = useAutoTableRows({ minRows: 3 });
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(visibleProjects.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pagedProjects = visibleProjects.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  // Reset to page 1 whenever the underlying row count or fitted row count
  // changes (archived toggle, a project added/removed, or a resize that
  // changes rowsPerPage) — otherwise the view could land on a now-empty
  // trailing page.
  useEffect(() => {
    setPage(1);
  }, [visibleProjects.length, rowsPerPage, showArchived]);

  return (
    // No Card wrapper (docs/ux-ui-guidelines.md "Tables inside cards":
    // a table already implies a contained, structured block, so it's
    // used directly in the layout instead of double-boxed inside a
    // card). flex-1 min-h-0 still fills the remaining viewport height
    // under the page header (app/projects/page.tsx) — same "this
    // element grows, its own scroll area handles overflow" shape as
    // the dashboard's cards, just without the outer card border.
    <>
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
          Projects
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleShowArchived} disabled={isLoadingArchived}>
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
          <Button variant="default" size="sm" onClick={() => setIsAddOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add project
          </Button>
        </div>
      </div>

      {rowError && (
        <p className="shrink-0 text-[var(--text-sm)] text-[var(--destructive)]">{rowError}</p>
      )}

      {visibleProjects.length === 0 ? (
        <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
          {showArchived ? "No projects yet." : "No active projects yet."}
        </p>
      ) : (
        <>
          {/* containerRef here is what useAutoTableRows measures: the
              available height for card + pagination bar together. Rows
              that don't fit move to the next page (see pagedProjects)
              instead of causing this card to scroll internally. */}
          <div
            ref={tableCardRef}
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)]">
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[32%]" />
                  <col className="w-[20%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="shrink-0 border-b border-[var(--border)] bg-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-2 text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
                      Project
                    </th>
                    <th className="px-4 py-2 text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
                      Next milestone
                    </th>
                    <th className="px-4 py-2 text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
                      Milestones
                    </th>
                    <th className="px-4 py-2 text-right text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
                      Total
                    </th>
                    <th className="px-4 py-2 text-right text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)]">
                  {pagedProjects.map((project) =>
                    editingId === project.id ? (
                      <tr key={project.id}>
                        <td colSpan={5} className="p-4">
                          <EditProjectForm
                            defaultValues={{
                              title: project.title,
                              billedToName: project.billedToName ?? "",
                              billedToAttention: project.billedToAttention ?? "",
                            }}
                            onSubmit={(data) => handleUpdate(project.id, data)}
                            onCancel={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={project.id}
                        onClick={() => openProject(project.id)}
                        className="cursor-pointer hover:bg-[var(--muted)]"
                      >
                        <td className="truncate px-4 py-2 align-top text-[var(--text-base)] text-[var(--foreground)]">
                          {project.title}
                        </td>
                        <td className="px-4 py-2 align-top text-[var(--text-sm)] text-[var(--muted-foreground)]">
                          {project.nextMilestone ? (
                            <span className="truncate">
                              {project.nextMilestone.title} ({CURRENCY_SYMBOL}
                              {formatCurrency(project.nextMilestone.price)})
                            </span>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top text-[var(--text-sm)] text-[var(--muted-foreground)]">
                          {project.completedMilestoneCount}/{project.milestoneCount}{" "}
                          {project.milestoneCount === 1 ? "milestone" : "milestones"}
                        </td>
                        <td className="px-4 py-2 text-right align-top text-[var(--text-base)] font-semibold text-[var(--foreground)]">
                          {CURRENCY_SYMBOL}
                          {formatCurrency(project.price)}
                        </td>
                        <td className="px-4 py-2 text-right align-top">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit project"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(project.id);
                              }}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={project.status === "active" ? "Archive project" : "Restore project"}
                              disabled={archivingId === project.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveToggle(project);
                              }}
                            >
                              {project.status === "active" ? (
                                <Archive className="size-4" aria-hidden="true" />
                              ) : (
                                <ArchiveRestore className="size-4" aria-hidden="true" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex shrink-0 items-center justify-between px-1">
                <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                  Showing{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {(currentPage - 1) * rowsPerPage + 1}
                    {"\u2013"}
                    {Math.min(currentPage * rowsPerPage, visibleProjects.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {visibleProjects.length}
                  </span>{" "}
                  projects
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Previous page"
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </Button>
                  <span className="px-2 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                    Page{" "}
                    <span className="font-semibold text-[var(--foreground)]">{currentPage}</span>{" "}
                    of{" "}
                    <span className="font-semibold text-[var(--foreground)]">{totalPages}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Next page"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-[560px] p-6">
          <DialogTitle>Add project</DialogTitle>
          <DialogDescription>
            Add the project and its first milestone. You can add more milestones later
            from the project page.
          </DialogDescription>
          <CreateProjectForm onSubmit={handleCreate} onCancel={() => setIsAddOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
