"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Archive, ArchiveRestore, Save, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  projectSchema,
  milestoneSchema,
  type ProjectInput,
} from "@/lib/validation/projects";
import { CURRENCY_SYMBOL, formatCurrency } from "@/lib/currency";
import { useMilestonesDialog } from "@/app/projects/milestones-dialog";

type Project = {
  id: string;
  title: string;
  price: string;
  status: "active" | "archived";
  billedToName?: string | null;
  billedToAttention?: string | null;
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
  const [isAdding, setIsAdding] = useState(false);
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
    setProjects((prev) => [project, ...prev]);
    setIsAdding(false);
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

  return (
    <Card className="rounded-[var(--radius-lg)]">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Projects
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleShowArchived} disabled={isLoadingArchived}>
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
            {!isAdding && (
              <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
                <Plus className="size-4" aria-hidden="true" />
                Add project
              </Button>
            )}
          </div>
        </div>

        {isAdding && (
          <CreateProjectForm onSubmit={handleCreate} onCancel={() => setIsAdding(false)} />
        )}

        {rowError && (
          <p className="text-[var(--text-sm)] text-[var(--destructive)]">{rowError}</p>
        )}

        {visibleProjects.length === 0 && !isAdding ? (
          <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
            {showArchived ? "No projects yet." : "No active projects yet."}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {visibleProjects.map((project) =>
              editingId === project.id ? (
                <div key={project.id} className="py-4 first:pt-0 last:pb-0">
                  <EditProjectForm
                    defaultValues={{
                      title: project.title,
                      billedToName: project.billedToName ?? "",
                      billedToAttention: project.billedToAttention ?? "",
                    }}
                    onSubmit={(data) => handleUpdate(project.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => openProject(project.id)}
                  className="flex items-center justify-between gap-4 py-4 text-left first:pt-0 last:pb-0 hover:bg-[var(--muted)]"
                >
                  <span className="text-[var(--text-base)] text-[var(--foreground)]">
                    {project.title}
                    {project.status === "archived" && (
                      <span className="ml-2 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                        Archived
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-base)] font-semibold text-[var(--foreground)]">
                      {CURRENCY_SYMBOL}
                      {formatCurrency(project.price)}
                    </span>
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
                </button>
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
