"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionLabel, actorName, formatTimestamp, formatDetail } from "@/lib/activity/format";
import useAutoTableRows from "@/lib/hooks/useAutoTableRows";

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
  "settings.designated_payer_updated",
] as const;

type Filters = { actor: string; action: string; from: string; to: string };
const EMPTY_FILTERS: Filters = { actor: "", action: "", from: "", to: "" };

export function ActivityLogList({
  initialEntries,
  initialTotal,
  pageSize: initialPageSize,
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

  // Auto-fit pagination (same hook the projects table uses). The activity
  // log is server-paginated (DB query with LIMIT/OFFSET, not everything
  // loaded client-side), so — unlike the projects table's client-side
  // slice — this needs to actually ask the server for the row count that
  // fits, via per_page below, rather than slicing an already-fetched array.
  const { containerRef: tableCardRef, rowsPerPage } = useAutoTableRows({ minRows: 3 });
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isFirstLoad = page === 1 && pageSize === initialPageSize && Object.values(filters).every((v) => !v);

  // When the fitted row count changes, adopt it as the active page size —
  // debounced via the effect below re-fetching page 1, mirroring
  // amkor-ims's onPageSizeChange correction flow.
  useEffect(() => {
    if (rowsPerPage === pageSize) return;
    const timer = setTimeout(() => {
      setPageSize(rowsPerPage);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [rowsPerPage, pageSize]);

  useEffect(() => {
    // Skip the extra fetch on mount — the server component already
    // loaded page 1 with no filters at the initial page size.
    if (isFirstLoad) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page), per_page: String(pageSize) });
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
  }, [page, pageSize, filters]);

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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Card className="shrink-0 flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:flex-wrap">
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
        <p className="shrink-0 text-[var(--text-sm)] text-[var(--destructive)]">{error}</p>
      )}

      {!loading && entries.length === 0 ? (
        <Card className="flex items-center justify-center p-10 text-[var(--text-sm)] text-[var(--muted-foreground)]">
          {hasActiveFilters
            ? "No activity matches these filters."
            : "No activity has been logged yet."}
        </Card>
      ) : (
        <>
          {/* containerRef is what useAutoTableRows measures: the available
              height for card + pagination bar together. This table is
              server-paginated, so a fitted row count change re-requests
              page 1 at the new per_page (see the effect above) rather
              than slicing an already-fetched array like the projects
              table does. */}
          <div ref={tableCardRef} className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)]">
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[20%]" />
                  <col className="w-[42%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead className="shrink-0 border-b border-[var(--border)] bg-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-2 text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
                      Actor
                    </th>
                    <th className="px-4 py-2 text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
                      Action
                    </th>
                    <th className="px-4 py-2 text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
                      Detail
                    </th>
                    <th className="px-4 py-2 text-right text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)]">
                  {entries.map((entry) => {
                    const detail = formatDetail(entry.action, entry.detail);
                    return (
                      <tr key={entry.id}>
                        <td className="truncate px-4 py-2 align-top text-[var(--text-base)] font-semibold text-[var(--foreground)]">
                          {actorName(entry)}
                        </td>
                        <td className="px-4 py-2 align-top text-[var(--text-sm)] text-[var(--foreground)]">
                          {actionLabel(entry.action)}
                        </td>
                        <td className="truncate px-4 py-2 align-top text-[var(--text-sm)] text-[var(--muted-foreground)]">
                          {detail ?? "-"}
                        </td>
                        <td className="px-4 py-2 text-right align-top text-[var(--text-sm)] text-[var(--muted-foreground)]">
                          {formatTimestamp(entry.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex shrink-0 items-center justify-between px-1">
                <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                  Showing{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {(page - 1) * pageSize + 1}
                    {"\u2013"}
                    {Math.min(page * pageSize, total)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[var(--foreground)]">{total}</span>{" "}
                  entries
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Previous page"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </Button>
                  <span className="px-2 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                    Page{" "}
                    <span className="font-semibold text-[var(--foreground)]">{page}</span>{" "}
                    of{" "}
                    <span className="font-semibold text-[var(--foreground)]">{totalPages}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Next page"
                    disabled={page >= totalPages || loading}
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
  );
}
