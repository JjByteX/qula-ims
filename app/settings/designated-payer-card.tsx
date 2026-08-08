"use client";

import { useState } from "react";
import { CircleCheck, CircleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type PayerOption = {
  id: string;
  name: string;
  profileComplete: boolean;
};

// "Who receives payment" (docs/phases-plan-revision-1.md Phase 12.3) —
// a radio button per active user, showing name + payment-profile
// completeness. Selecting one calls PATCH /api/settings/designated-payer
// straight away (no separate Save step), same immediate-effect pattern
// as e.g. marking an invoice paid elsewhere in the app — there's only
// one field here, so a Save/Cancel pair would just add friction.
//
// Changing this never touches documents already generated — see the
// comment on the route this calls (app/api/settings/designated-payer/
// route.ts) for the snapshot-principle reasoning.
export function DesignatedPayerCard({
  users,
  initialDesignatedPayerUserId,
}: {
  users: PayerOption[];
  initialDesignatedPayerUserId: string | null;
}) {
  const [designatedPayerUserId, setDesignatedPayerUserId] = useState<string | undefined>(
    initialDesignatedPayerUserId ?? undefined,
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSelect(userId: string) {
    setServerError(null);
    setPendingId(userId);
    try {
      const res = await fetch("/api/settings/designated-payer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designatedPayerUserId: userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setServerError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      setDesignatedPayerUserId(userId);
    } catch {
      setServerError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card className="rounded-[var(--radius-lg)]">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Who receives payment
          </span>
          <span className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            New invoices prefill this person&apos;s payment details and signature.
          </span>
        </div>

        {users.length === 0 ? (
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            No active users yet.
          </p>
        ) : (
          <RadioGroup
            name="designatedPayer"
            value={designatedPayerUserId}
            onValueChange={onSelect}
            className="flex flex-col gap-3"
          >
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <RadioGroupItem
                    id={`payer-${u.id}`}
                    value={u.id}
                    disabled={pendingId !== null}
                  />
                  <Label htmlFor={`payer-${u.id}`} className="font-normal">
                    {u.name}
                  </Label>
                </div>
                {u.profileComplete ? (
                  <span className="flex items-center gap-1.5 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                    <CircleCheck className="size-4" aria-hidden="true" />
                    Payment profile complete
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                    <CircleAlert className="size-4" aria-hidden="true" />
                    Payment profile incomplete
                  </span>
                )}
              </div>
            ))}
          </RadioGroup>
        )}

        {serverError && (
          <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
        )}
      </CardContent>
    </Card>
  );
}
