"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  notificationSettingsSchema,
  type NotificationSettingsInput,
} from "@/lib/validation/settings";

// Notification settings (phases-plan 6.1 / Client-Requests.md "Set the
// number of days before the notification"). Same view/edit-toggle shape
// as the allocated-funds editor in app/dashboard/budget-section.tsx,
// since this is the same kind of thing: one editable value in its own
// card.
export function NotificationSettingsForm({
  initialDaysBefore,
}: {
  initialDaysBefore: number;
}) {
  const [daysBefore, setDaysBefore] = useState(initialDaysBefore);
  const [isEditing, setIsEditing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<NotificationSettingsInput>({
    resolver: zodResolver(notificationSettingsSchema),
    mode: "onChange",
    defaultValues: { notificationDaysBefore: initialDaysBefore },
  });

  function startEditing() {
    reset({ notificationDaysBefore: daysBefore });
    setServerError(null);
    setIsEditing(true);
  }

  async function onSubmit(data: NotificationSettingsInput) {
    setServerError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setServerError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      const { settings: updated } = await res.json();
      setDaysBefore(updated.notificationDaysBefore);
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
            Notification lead time
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
              <Label htmlFor="notificationDaysBefore">Days before</Label>
              <Input
                id="notificationDaysBefore"
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                aria-invalid={!!errors.notificationDaysBefore}
                {...register("notificationDaysBefore", { valueAsNumber: true })}
              />
              {errors.notificationDaysBefore && (
                <p className="text-[var(--text-sm)] text-[var(--destructive)]">
                  {errors.notificationDaysBefore.message}
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
            {daysBefore} {daysBefore === 1 ? "day" : "days"} before
          </p>
        )}
      </CardContent>
    </Card>
  );
}
