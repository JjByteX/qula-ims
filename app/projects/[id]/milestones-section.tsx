"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  CircleCheck,
  CircleX,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  FileText,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { CURRENCY_SYMBOL, formatCurrency } from "@/lib/currency";
import { milestoneSchema, type MilestoneInput } from "@/lib/validation/projects";
import type { Milestone, ProjectDocument } from "@/db/schema";

// Invoice/AR creation, folded into the milestone row (Projects page
// request: one card, not two — the 3-dot menu next to Delete is the new
// entry point instead of the old separate "Invoices & Acknowledgement
// Receipts" card with its own milestone-picker dropdown). The menu item
// creates the document immediately (prefilled from the milestone, see
// handleCreateDocument) and navigates to its page rather than expanding an
// inline form here.

// Milestones section (phases-plan 3.1/3.4, revised for multi-milestone
// projects). Replaces the old single MilestoneStatus toggle with an
// ordered list — a project can now have as many named, individually
// priced stages as the engagement actually has (matching how real
// proposals bill: named milestone + its own amount, summing to a total),
// each with its own complete/reopen state. Reordering is plain up/down
// buttons rather than a drag library — the list is short (a handful of
// stages per project), so drag-and-drop would be more UI than the task
// needs.
function MilestoneForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  defaultValues: MilestoneInput;
  onSubmit: (data: MilestoneInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<MilestoneInput>({
    resolver: zodResolver(milestoneSchema),
    mode: "onChange",
    defaultValues,
  });

  async function submit(data: MilestoneInput) {
    setServerError(null);
    try {
      await onSubmit(data);
    } catch {
      setServerError("Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone-title">Milestone</Label>
          <Input id="milestone-title" aria-invalid={!!errors.title} {...register("title")} />
          {errors.title && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">
              {errors.title.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone-price">Price</Label>
          <Input
            id="milestone-price"
            inputMode="decimal"
            aria-invalid={!!errors.price}
            {...register("price")}
          />
          {errors.price && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">
              {errors.price.message}
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

export function MilestonesSection({
  projectId,
  projectTitle,
  projectStatus,
  initialMilestones,
  documents: initialDocuments,
  onNavigateAway,
}: {
  projectId: string;
  projectTitle: string;
  projectStatus: "active" | "archived";
  initialMilestones: Milestone[];
  documents: ProjectDocument[];
  // Called right before navigating to the invoice/AR page. Lets the
  // milestones dialog (app/projects/milestones-dialog.tsx) close itself
  // first. Optional and a no-op by default so this component still works
  // as-is on the plain /projects/[id] page, where there's no dialog to
  // close — router.push there just replaces the page normally.
  onNavigateAway?: () => void;
}) {
  const router = useRouter();
  const [milestones, setMilestones] = useState(
    [...initialMilestones].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder)),
  );
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [creatingDocFor, setCreatingDocFor] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  function hasDocument(milestoneId: string) {
    return documents.some((doc) => doc.milestoneId === milestoneId);
  }

  function existingDocument(milestoneId: string, type: "invoice" | "ar") {
    return documents.find((doc) => doc.milestoneId === milestoneId && doc.type === type);
  }

  // Menu item creates the document immediately (prefilled from the
  // milestone, everything else blank) and takes the person straight to its
  // page, where the existing Edit action (DocumentToolbar) is how the rest
  // of the fields get filled in — no inline form on this page anymore.
  // If this milestone already has a document of the requested type,
  // there's nothing to create — just open the one that's already there
  // instead of POSTing another (that used to insert a duplicate row every
  // time the menu item was clicked again).
  async function handleCreateDocument(milestoneId: string, type: "invoice" | "ar") {
    const existing = existingDocument(milestoneId, type);
    if (existing) {
      onNavigateAway?.();
      router.push(`/projects/${projectId}/documents/${existing.id}`);
      return;
    }

    setCreatingDocFor(milestoneId);
    setDocError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, milestoneId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setDocError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      const { document } = await res.json();
      setDocuments((prev) => [document, ...prev]);
      onNavigateAway?.();
      router.push(`/projects/${projectId}/documents/${document.id}`);
    } catch {
      setDocError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setCreatingDocFor(null);
    }
  }

  async function handleCreate(data: MilestoneInput) {
    const res = await fetch(`/api/projects/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Something went wrong.");
    }
    const { milestone } = await res.json();
    setMilestones((prev) => [...prev, milestone]);
    setIsAdding(false);
    router.refresh();
  }

  async function handleUpdate(id: string, data: MilestoneInput) {
    const res = await fetch(`/api/projects/${projectId}/milestones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Something went wrong.");
    }
    const { milestone } = await res.json();
    setMilestones((prev) => prev.map((m) => (m.id === id ? milestone : m)));
    setEditingId(null);
    router.refresh();
  }

  async function handleToggleComplete(milestone: Milestone) {
    setBusyId(milestone.id);
    setRowError(null);
    try {
      const action = milestone.status === "completed" ? "reopen" : "complete";
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestone.id}/${action}`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setRowError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      const { milestone: updated } = await res.json();
      setMilestones((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      router.refresh();
    } catch {
      setRowError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(milestone: Milestone) {
    setBusyId(milestone.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestone.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setRowError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      setMilestones((prev) => prev.filter((m) => m.id !== milestone.id));
      router.refresh();
    } catch {
      setRowError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReorder(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= milestones.length) return;

    const reordered = [...milestones];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setMilestones(reordered);
    setRowError(null);

    const res = await fetch(`/api/projects/${projectId}/milestones/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneIds: reordered.map((m) => m.id) }),
    });
    if (!res.ok) {
      // Revert on failure rather than leaving the UI showing an order the
      // server didn't accept.
      setMilestones(milestones);
      const body = await res.json().catch(() => null);
      setRowError(body?.error ?? "Couldn't save the new order. Try again.");
      return;
    }
    router.refresh();
  }

  const totalPrice = milestones
    .reduce((sum, m) => sum + Number(m.price), 0)
    .toFixed(2);

  return (
    <Card className="rounded-[var(--radius-lg)]">
      {/* pr-12 on the header row only (not the whole card) reserves room
          for DialogContent's close button, which is absolutely positioned
          at top-4 right-4 of the dialog shell — this Card sits flush
          against that edge since ProjectModal renders DialogContent with
          p-0. Without the offset, "Add milestone" lands directly under
          the X with almost no gap. */}
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-4 pr-12">
          <div className="flex items-center gap-2">
            <h1 className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
              {projectTitle}
              {projectStatus === "archived" && (
                <span className="ml-2 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                  Archived
                </span>
              )}
            </h1>
            <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
              ({milestones.length} {milestones.length === 1 ? "Milestone" : "Milestones"})
            </span>
          </div>
          {!isAdding && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Add milestone
            </Button>
          )}
        </div>

        {isAdding && (
          <div className="border-t border-[var(--border)] pt-4">
            <MilestoneForm
              defaultValues={{ title: "", price: "" }}
              onSubmit={handleCreate}
              onCancel={() => setIsAdding(false)}
              submitLabel="Add"
            />
          </div>
        )}

        {rowError && <p className="text-[var(--text-sm)] text-[var(--destructive)]">{rowError}</p>}
        {docError && <p className="text-[var(--text-sm)] text-[var(--destructive)]">{docError}</p>}

        {milestones.length === 0 && !isAdding ? (
          <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
            No milestones yet.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {milestones.map((milestone, index) =>
              editingId === milestone.id ? (
                <div key={milestone.id} className="py-4 first:pt-0 last:pb-0">
                  <MilestoneForm
                    defaultValues={{ title: milestone.title, price: milestone.price }}
                    onSubmit={(data) => handleUpdate(milestone.id, data)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Save"
                  />
                </div>
              ) : (
                <div key={milestone.id} className="flex flex-col py-4 first:pt-0 last:pb-0">
                <div
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Move up"
                        disabled={index === 0 || busyId === milestone.id}
                        onClick={() => handleReorder(index, -1)}
                        className="size-6"
                      >
                        <ChevronUp className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Move down"
                        disabled={index === milestones.length - 1 || busyId === milestone.id}
                        onClick={() => handleReorder(index, 1)}
                        className="size-6"
                      >
                        <ChevronDown className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[var(--text-base)] text-[var(--foreground)]">
                        {milestone.title}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={milestone.status === "completed" ? "success" : "outline"}>
                          {milestone.status === "completed" ? "Complete" : "In progress"}
                        </Badge>
                        {milestone.status === "completed" && !hasDocument(milestone.id) && (
                          <Badge variant="destructive">
                            <AlertCircle className="size-3" aria-hidden="true" />
                            No invoice or AR
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-[var(--text-base)] font-semibold text-[var(--foreground)]">
                      {CURRENCY_SYMBOL}
                      {formatCurrency(milestone.price)}
                    </span>
                    {/* Tight gap-0.5 groups these four as one toolbar,
                        distinct from the gap-6 that separates the price
                        (data) from the actions (controls) above. */}
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={milestone.status === "completed" ? "Reopen milestone" : "Mark milestone complete"}
                        disabled={busyId === milestone.id}
                        onClick={() => handleToggleComplete(milestone)}
                      >
                        {milestone.status === "completed" ? (
                          <CircleX className="size-4" aria-hidden="true" />
                        ) : (
                          <CircleCheck className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit milestone"
                        onClick={() => setEditingId(milestone.id)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete milestone"
                        disabled={busyId === milestone.id}
                        onClick={() => handleDelete(milestone)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Milestone document options"
                            disabled={creatingDocFor === milestone.id}
                          >
                            <MoreVertical className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {milestone.status === "completed" ? (
                            <>
                              <DropdownMenuItem
                                onSelect={() => handleCreateDocument(milestone.id, "invoice")}
                              >
                                <FileText className="size-4" aria-hidden="true" />
                                Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => handleCreateDocument(milestone.id, "ar")}
                              >
                                <Receipt className="size-4" aria-hidden="true" />
                                Acknowledgement Receipt
                              </DropdownMenuItem>
                            </>
                          ) : (
                            // Docs/phases-plan-revision-2.md Phase 18: an
                            // invoice or AR only ever makes sense for a
                            // finished milestone — billing for work not
                            // done yet isn't a real case this app needs
                            // to support. Rather than let the person pick
                            // Invoice/AR and then fail or produce a
                            // document for unfinished work, this same
                            // menu position asks to mark the milestone
                            // done first. preventDefault keeps the menu
                            // open through the click (Radix's default is
                            // to close on select) — handleToggleComplete
                            // flips milestone.status, which re-renders
                            // this same DropdownMenuContent showing the
                            // real Invoice/AR items above instead,
                            // without the person needing to reopen the
                            // menu.
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                handleToggleComplete(milestone);
                              }}
                              disabled={busyId === milestone.id}
                            >
                              <CircleCheck className="size-4" aria-hidden="true" />
                              {busyId === milestone.id
                                ? "Marking as done..."
                                : "Mark as done to create invoice/AR"}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                </div>
              ),
            )}
          </div>
        )}

        {/* Total moved here from the header (invoice/receipt convention:
            the sum reads as a conclusion after the line items, not a
            number the person has to hold in mind before seeing what it's
            made of). Border-top gives it the same "subtotal line" framing
            you'd see on a receipt. */}
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
          <span className="text-[var(--text-base)] font-semibold text-[var(--foreground)]">
            Total
          </span>
          <span className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
            {CURRENCY_SYMBOL}
            {formatCurrency(totalPrice)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
