"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { allocatedFundsSchema, type AllocatedFundsInput } from "@/lib/validation/budget";

// No currency was specified anywhere in the docs (Client-Requests.md and
// tech-stack.md are both silent on it), so this is a single constant to
// change in one place rather than a guess baked into every display.
export const CURRENCY_SYMBOL = "$";

// Matches the numeric(14,2) column: whole-number grouping, exactly two
// decimals — this is a display formatter only, the raw string is what's
// actually sent to and stored by the API. Exported so the remaining
// budget summary (phases-plan 2.3) matches this formatting exactly
// instead of re-implementing it.
export function formatCurrency(value: string): string {
  const amount = Number(value);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function AllocatedFundsForm({
  initialAllocatedFunds,
  onAllocatedFundsChange,
}: {
  initialAllocatedFunds: string;
  // Lets the parent (BudgetPage) keep the remaining-budget calculation
  // (phases-plan 2.3) in sync without lifting this form's whole edit
  // state — called once on mount with the initial value and again after
  // every successful save.
  onAllocatedFundsChange?: (allocatedFunds: string) => void;
}) {
  const [allocatedFunds, setAllocatedFunds] = useState(initialAllocatedFunds);
  const [isEditing, setIsEditing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<AllocatedFundsInput>({
    resolver: zodResolver(allocatedFundsSchema),
    mode: "onChange",
    defaultValues: { allocatedFunds: initialAllocatedFunds },
  });

  // Reports the initial value once so the parent's remaining-budget
  // total (phases-plan 2.3) has something to subtract from on first
  // paint, not just after the first edit.
  useEffect(() => {
    onAllocatedFundsChange?.(initialAllocatedFunds);
    // Only ever meant to run once, on mount — the initial value doesn't
    // change on this client after the server render, and re-running on
    // every onAllocatedFundsChange identity change would be wasted work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEditing() {
    reset({ allocatedFunds });
    setServerError(null);
    setIsEditing(true);
  }

  async function onSubmit(data: AllocatedFundsInput) {
    setServerError(null);
    try {
      const res = await fetch("/api/budget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setServerError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      const { budget: updated } = await res.json();
      setAllocatedFunds(updated.allocatedFunds);
      onAllocatedFundsChange?.(updated.allocatedFunds);
      setIsEditing(false);
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <Card className="rounded-[var(--radius-lg)]">
      <CardContent className="flex flex-col gap-4 p-8">
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Allocated funds
          </span>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="allocatedFunds">Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-base)] text-[var(--muted-foreground)]">
                  {CURRENCY_SYMBOL}
                </span>
                <Input
                  id="allocatedFunds"
                  inputMode="decimal"
                  className="pl-7"
                  aria-invalid={!!errors.allocatedFunds}
                  {...register("allocatedFunds")}
                />
              </div>
              {errors.allocatedFunds && (
                <p className="text-[var(--text-sm)] text-[var(--destructive)]">
                  {errors.allocatedFunds.message}
                </p>
              )}
            </div>

            {serverError && (
              <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={!isValid || isSubmitting}>
                <Save className="size-4" aria-hidden="true" />
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isSubmitting}
              >
                <X className="size-4" aria-hidden="true" />
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
            {CURRENCY_SYMBOL}
            {formatCurrency(allocatedFunds)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
