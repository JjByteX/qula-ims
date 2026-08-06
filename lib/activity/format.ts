// Display formatting shared between the full activity log
// (app/activity/activity-log-list.tsx) and the dashboard's recent
// activity summary (app/dashboard/recent-activity.tsx), so an entry
// reads identically in both places. Pulled out here rather than kept
// page-local now that a second surface needs the same formatting.

export type ActivityEntryLike = {
  action: string;
  actorFirstName: string | null;
  actorLastName: string | null;
};

export function actionLabel(action: string): string {
  // "expense.deleted" -> "Expense deleted"
  const [, verb] = action.split(".");
  const noun = action.split(".")[0];
  const words = `${noun} ${verb ?? ""}`.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function actorName(entry: ActivityEntryLike): string {
  if (!entry.actorFirstName) return "System";
  return `${entry.actorFirstName} ${entry.actorLastName ?? ""}`.trim();
}

export function formatTimestamp(value: string | Date): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDetail(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const entries = Object.entries(detail as Record<string, unknown>);
  if (!entries.length) return null;
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ");
}
