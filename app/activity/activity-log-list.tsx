"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionLabel, actorName, formatTimestamp, formatDetail } from "@/lib/activity/format";

export type ActivityEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: unknown;
  createdAt: string | Date;
  actorUserId: string | null;
  actorFirstName: string | null;
  actorLastName: string | null;
};

type Actor = { id: string; firstName: string; lastName: string };

// Every action string written by lib/activity/log.ts (phases-plan 4.2).
// Kept as a static list rather than a `SELECT DISTINCT action` query — a
// fresh install's log is empty, so a DB-derived list would start blank
// and only grow as entries happen to occur, which makes filtering by an
// action nobody has triggered yet impossible even though it's a real
// action the system can log.
const ACTIONS = [
  "user.registered",
  "user.created",
  "user.approved",
  "user.denied",
  "user.edited",
  "budget.allocated_funds_updated",
  "budget.splitter_updated",
  "expense.created",
  "expense.edited",
  "expense.deleted",
  "project.created",
  "project.edited",
  "project.archived",
  "project.unarchived",
  "milestone.created",
  "milestone.edited",
  "milestone.deleted",
  "milestone.completed",
  "milestone.reopened",
  "milestone.reordered",
  "invoice.created",
  "invoice.edited",
  "invoice.refreshed",
  "invoice.marked_paid",
  "invoice.marked_unpaid",
  "ar.created",
  "ar.edited",
  "ar.refreshed",
  "settings.notification_days_updated",
  "settings.designated_payer_updated",
] as const;

type Filters = { actor: string; action: string; from: string; to: string };
const EMPTY_FILTERS: Filters = { actor: "", action: "", from: "", to: "" };

export function ActivityLogList({
  initialEntries,
  initialTotal,
  pageSize,
  actors,
}: {
  initialEntries: ActivityEntry[];
  initialTotal: number;
  pageSize: number;
  actors: Actor[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isFirstLoad = page === 1 && Object.values(filters).every((v) => !v);

  useEffect(() => {
    // Skip the extra fetch on mount — the server component already
    // loaded page 1 with no filters.
    if (isFirstLoad) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page) });
    if (filters.actor) params.set("actor", filters.actor);
    if (filters.action) params.set("action", filters.action);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);

    fetch(`/api/activity?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Couldn't load the activity log.");
        return res.json();
      })
      .then((data) => {
        setEntries(data.entries);
        setTotal(data.total);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError("Couldn't load the activity log. Try again.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters]);

  function updateFilter(key: keyof Filters, value: string) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setPage(1);
    setFilters(EMPTY_FILTERS);
  }

  const hasActiveFilters = Object.values(filters).some((v) => v);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-actor" className="text-[var(--text-sm)]">
            Actor
          </Label>
          <select
            id="activity-actor"
            className="h-10 rounded-[var(--radius-sm)] border border-[var(--input)] bg-[var(--background)] px-3 text-[var(--text-sm)] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            value={filters.actor}
            onChange={(e) => updateFilter("actor", e.target.value)}
          >
            <option value="">Anyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-action" className="text-[var(--text-sm)]">
            Action
          </Label>
          <select
            id="activity-action"
            className="h-10 rounded-[var(--radius-sm)] border border-[var(--input)] bg-[var(--background)] px-3 text-[var(--text-sm)] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            value={filters.action}
            onChange={(e) => updateFilter("action", e.target.value)}
          >
            <option value="">Any action</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-from" className="text-[var(--text-sm)]">
            From
          </Label>
          <Input
            id="activity-from"
            type="date"
            className="w-[160px]"
            value={filters.from}
            onChange={(e) => updateFilter("from", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activity-to" className="text-[var(--text-sm)]">
            To
          </Label>
          <Input
            id="activity-to"
            type="date"
            className="w-[160px]"
            value={filters.to}
            onChange={(e) => updateFilter("to", e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </Card>

      {error && (
        <p className="text-[var(--text-sm)] text-[var(--destructive)]">{error}</p>
      )}

      {!loading && entries.length === 0 && (
        <Card className="flex items-center justify-center p-10 text-[var(--text-sm)] text-[var(--muted-foreground)]">
          {hasActiveFilters
            ? "No activity matches these filters."
            : "No activity has been logged yet."}
        </Card>
      )}

      {entries.length > 0 && (
        <Card className="flex flex-col divide-y divide-[var(--border)] overflow-hidden">
          {entries.map((entry) => {
            const detail = formatDetail(entry.action, entry.detail);
            return (
              <div
                key={entry.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-[var(--text-sm)] text-[var(--foreground)]">
                    <span className="font-semibold">{actorName(entry)}</span>{" "}
                    {actionLabel(entry.action).toLowerCase()}
                    {detail && (
                      <span className="text-[var(--muted-foreground)]"> — {detail}</span>
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                  {formatTimestamp(entry.createdAt)}
                </p>
              </div>
            );
          })}
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            Page {page} of {totalPages} · {total} entries
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
