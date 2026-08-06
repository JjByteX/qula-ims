import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { actionLabel, actorName, formatDetail, formatTimestamp } from "@/lib/activity/format";

export type RecentActivityEntry = {
  id: string;
  action: string;
  targetType: string;
  detail: unknown;
  createdAt: string | Date;
  actorFirstName: string | null;
  actorLastName: string | null;
};

// Recent activity (phases-plan 5.4 / Client-Requests.md "Last 5 to 10
// entries from the Activity log"). Formatting matches the full activity
// log page exactly (same lib/activity/format.ts helpers) so an entry
// reads the same whether it's seen here or on /activity — this is a
// preview of that page, not a different view of the data. The whole
// card links to /activity (phases-plan 5.5).
export function RecentActivity({ entries }: { entries: RecentActivityEntry[] }) {
  return (
    <Link href="/activity" className="block">
      <Card className="rounded-[var(--radius-lg)] transition-colors hover:bg-[var(--muted)]">
        <CardContent className="flex flex-col gap-4 p-8">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Recent activity
          </span>

          {entries.length === 0 ? (
            <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
              No activity yet.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {entries.map((entry) => {
                const detail = formatDetail(entry.detail);
                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <p className="text-[var(--text-sm)] text-[var(--foreground)]">
                      <span className="font-semibold">{actorName(entry)}</span>{" "}
                      {actionLabel(entry.action).toLowerCase()}
                      {detail && (
                        <span className="text-[var(--muted-foreground)]"> — {detail}</span>
                      )}
                    </p>
                    <p className="shrink-0 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                      {formatTimestamp(entry.createdAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
