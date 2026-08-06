"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { CURRENCY_SYMBOL, formatCurrency } from "@/lib/currency";

type Split = {
  userId: string;
  firstName: string;
  lastName: string;
  percentage: number;
  isManual: boolean;
  amount: number;
};

type SplitterState = {
  enabled: boolean;
  remaining: number;
  splits: Split[];
};

// Fetched client-side rather than passed down from the server page — the
// splits depend on the remaining budget, which BudgetOverview is already
// recalculating live from local edits (phases-plan 2.3), so this refetches
// after those same events instead of needing BudgetOverview to also thread
// the raw expenses/allocated numbers into a duplicate calculation here.
export function BudgetSplitter({ refreshKey }: { refreshKey: number }) {
  const [state, setState] = useState<SplitterState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draftPercentages, setDraftPercentages] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    const res = await fetch("/api/budget/splitter");
    if (!res.ok) return;
    const data: SplitterState = await res.json();
    setState(data);
    setIsLoading(false);
  }

  useEffect(() => {
    load();
    // refreshKey ticks whenever allocated funds or expenses change
    // (phases-plan 2.4 "recalculate splits when budget... changes"), so
    // this intentionally re-runs on that signal, not just on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function startEditing() {
    if (!state) return;
    setDraftPercentages(
      Object.fromEntries(
        state.splits.filter((s) => s.isManual).map((s) => [s.userId, String(s.percentage)]),
      ),
    );
    setServerError(null);
    setIsEditing(true);
  }

  function setDraftPercentage(userId: string, value: string) {
    setDraftPercentages((prev) => ({ ...prev, [userId]: value }));
  }

  function clearOverride(userId: string) {
    setDraftPercentages((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }

  async function toggleEnabled(nextEnabled: boolean) {
    if (!state) return;
    setServerError(null);
    const res = await fetch("/api/budget/splitter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled, overrides: [] }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Something went wrong. Try again.");
      return;
    }
    const data: SplitterState = await res.json();
    setState(data);
  }

  async function saveOverrides() {
    if (!state) return;
    setServerError(null);
    setIsSubmitting(true);
    try {
      const overrides = Object.entries(draftPercentages)
        .filter(([, value]) => value.trim() !== "")
        .map(([userId, percentage]) => ({ userId, percentage }));

      const res = await fetch("/api/budget/splitter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: state.enabled, overrides }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setServerError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      const data: SplitterState = await res.json();
      setState(data);
      setIsEditing(false);
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !state) return null;

  return (
    <Card className="rounded-[var(--radius-lg)]">
      <CardContent className="flex flex-col gap-4 p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="splitter-enabled"
              checked={state.enabled}
              onCheckedChange={(checked) => toggleEnabled(checked === true)}
            />
            <Label htmlFor="splitter-enabled" className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
              Budget splitter
            </Label>
          </div>
          {state.enabled && !isEditing && state.splits.length > 0 && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit split
            </Button>
          )}
        </div>

        {serverError && (
          <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
        )}

        {!state.enabled ? (
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            Turn this on to split the remaining budget across the team.
          </p>
        ) : state.splits.length === 0 ? (
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            No active team members to split the budget across yet.
          </p>
        ) : isEditing ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {state.splits.map((split) => (
                <div key={split.userId} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="text-[var(--text-base)] text-[var(--foreground)]">
                    {split.firstName} {split.lastName}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="relative w-24">
                      <Input
                        inputMode="decimal"
                        placeholder={split.percentage.toFixed(0)}
                        value={draftPercentages[split.userId] ?? ""}
                        onChange={(e) => setDraftPercentage(split.userId, e.target.value)}
                        className="pr-7"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                        %
                      </span>
                    </div>
                    {draftPercentages[split.userId] !== undefined && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Use equal split for this person"
                        onClick={() => clearOverride(split.userId)}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
              Leave a field blank to give that person an equal share of what's left.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveOverrides} disabled={isSubmitting}>
                <Save className="size-4" aria-hidden="true" />
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={isSubmitting}
              >
                <X className="size-4" aria-hidden="true" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {state.splits.map((split) => (
              <div key={split.userId} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[var(--text-base)] text-[var(--foreground)]">
                    {split.firstName} {split.lastName}
                  </span>
                  <span className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                    {split.percentage.toFixed(1)}%{split.isManual ? " · custom" : ""}
                  </span>
                </div>
                <span className="text-[var(--text-base)] font-semibold text-[var(--foreground)]">
                  {CURRENCY_SYMBOL}
                  {formatCurrency(String(split.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
