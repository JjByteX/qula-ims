"use client";

import { useState } from "react";
import { Check, X, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type PendingRequest = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  email: string;
  contactNumber: string | null;
  description: string | null;
  profilePictureUrl: string | null;
  createdAt: string | Date;
};

function fullName(r: PendingRequest): string {
  return [r.firstName, r.middleName, r.lastName, r.suffix].filter(Boolean).join(" ");
}

function initials(r: PendingRequest): string {
  return `${r.firstName[0] ?? ""}${r.lastName[0] ?? ""}`.toUpperCase();
}

export function PendingRequestsList({ initialRequests }: { initialRequests: PendingRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function handleAction(id: string, action: "approve" | "deny") {
    setPendingActionId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/users/pending/${id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setRowError((prev) => ({
          ...prev,
          [id]: body?.error ?? "Something went wrong. Try again.",
        }));
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setRowError((prev) => ({
        ...prev,
        [id]: "Couldn't reach the server. Check your connection and try again.",
      }));
    } finally {
      setPendingActionId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center">
        <p className="text-[var(--text-base)] text-[var(--foreground)]">No pending requests.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {requests.map((r) => {
        const isBusy = pendingActionId === r.id;
        return (
          <Card key={r.id} className="flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <Avatar className="size-12">
                  <AvatarImage src={r.profilePictureUrl ?? undefined} alt="" />
                  <AvatarFallback>{initials(r)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <p className="text-[var(--text-base)] font-semibold text-[var(--foreground)]">
                    {fullName(r)}
                  </p>
                  <div className="flex flex-col gap-0.5 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1.5">
                      <Mail className="size-3.5" aria-hidden="true" />
                      {r.email}
                    </span>
                    {r.contactNumber && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="size-3.5" aria-hidden="true" />
                        {r.contactNumber}
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p className="mt-1 text-[var(--text-sm)] text-[var(--foreground)]">
                      {r.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => handleAction(r.id, "deny")}
                >
                  <X className="size-4" aria-hidden="true" />
                  Deny
                </Button>
                <Button
                  size="sm"
                  variant="accent"
                  disabled={isBusy}
                  onClick={() => handleAction(r.id, "approve")}
                >
                  <Check className="size-4" aria-hidden="true" />
                  Approve
                </Button>
              </div>
            </div>

            {rowError[r.id] && (
              <p className="text-[var(--text-sm)] text-[var(--destructive)]">{rowError[r.id]}</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
