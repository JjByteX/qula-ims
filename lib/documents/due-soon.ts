// Applies the notification lead time (phases-plan 6.1 / db/schema/settings.ts
// appSettings.notificationDaysBefore) to invoice due dates — the only
// timing concept in the schema (db/schema/projects.ts projectDocuments.dueDate).
// "Apply this setting wherever notification timing is used" (6.1) means
// this one function, used by every page that flags an invoice as due
// soon: app/projects/[id]/milestones-section.tsx and the dashboard's
// active-projects card.
//
// An invoice already marked paid is never "due soon" — the notification
// exists to prompt payment, and a paid invoice needs no prompting.
export function isInvoiceDueSoon(params: {
  type: "invoice" | "ar";
  isPaid: boolean;
  dueDate: string | null;
  notificationDaysBefore: number;
}): boolean {
  if (params.type !== "invoice" || params.isPaid || !params.dueDate) return false;

  const due = new Date(`${params.dueDate}T00:00:00`);
  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() + params.notificationDaysBefore);

  // Due today or within the lead time counts as due soon; already
  // overdue also counts — the notification shouldn't stop firing just
  // because the date has passed and nothing's been paid yet.
  return due.getTime() <= threshold.getTime();
}
