"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Archive, ArchiveRestore, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { projectSchema, type ProjectInput } from "@/lib/validation/projects";

type Project = {
  id: string;
  title: string;
  milestone: string;
  price: string;
  status: "active" | "archived";
};

function formatCurrency(value: string): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function ProjectForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  defaultValues: ProjectInput;
  onSubmit: (data: ProjectInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
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
        <Label htmlFor="title">Project title</Label>
        <Input id="title" aria-invalid={!!errors.title} {...register("title")} />
        {errors.title && (
          <p className="text-[var(--text-sm)] text-[var(--destructive)]">{errors.title.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone">Milestone</Label>
          <Input id="milestone" aria-invalid={!!errors.milestone} {...register("milestone")} />
          {errors.milestone && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">
              {errors.milestone.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            inputMode="decimal"
            aria-invalid={!!errors.price}
            {...register("price")}
          />
          {errors.price && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">{errors.price.message}</p>
          )}
        </div>
      </div>

      {serverError && (
        <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!isValid || isSubmitting}>
          <Save className="size-4" aria-hidden="true" />
          {isSubmitting ? "Saving..." : submitLabel}
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
  const [projects, setProjects] = useState(initialProjects);
  const [showArchived, setShowArchived] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [hasLoadedArchived, setHasLoadedArchived] = useState(false);

  async function handleCreate(data: ProjectInput) {
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
    setProjects((prev) => prev.map((p) => (p.id === id ? project : p)));
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
        // status in place rather than removing the row.
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
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
          <ProjectForm
            defaultValues={{ title: "", milestone: "", price: "" }}
            onSubmit={handleCreate}
            onCancel={() => setIsAdding(false)}
            submitLabel="Add"
          />
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
                  <ProjectForm
                    defaultValues={{
                      title: project.title,
                      milestone: project.milestone,
                      price: project.price,
                    }}
                    onSubmit={(data) => handleUpdate(project.id, data)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Save"
                  />
                </div>
              ) : (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[var(--text-base)] text-[var(--foreground)]">
                      {project.title}
                      {project.status === "archived" && (
                        <span className="ml-2 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                          Archived
                        </span>
                      )}
                    </span>
                    <span className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                      {project.milestone}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-base)] font-semibold text-[var(--foreground)]">
                      ${formatCurrency(project.price)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit project"
                      onClick={() => setEditingId(project.id)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={project.status === "active" ? "Archive project" : "Restore project"}
                      disabled={archivingId === project.id}
                      onClick={() => handleArchiveToggle(project)}
                    >
                      {project.status === "active" ? (
                        <Archive className="size-4" aria-hidden="true" />
                      ) : (
                        <ArchiveRestore className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
