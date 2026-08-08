// Display formatting shared between the full activity log
// (app/activity/activity-log-list.tsx) and the dashboard's recent
// activity summary (app/dashboard/recent-activity.tsx), so an entry
// reads identically in both places. Pulled out here rather than kept
// page-local now that a second surface needs the same formatting.
//
// Both actionLabel and formatDetail are written for a non-technical
// reader (docs/phases-plan-revision-2.md Phase 19) — plain English, no
// field names, no raw IDs, no leftover code words. Every action string
// this app writes (lib/activity/log.ts's callers) has its own explicit
// entry below rather than being derived by splitting the action string,
// since a generic split can't know which words actually make sense to
// read out loud (e.g. "budget.allocated_funds_updated" has no way to
// become "Updated the budget" just by replacing underscores with
// spaces).

export type ActivityEntryLike = {
  action: string;
  actorFirstName: string | null;
  actorLastName: string | null;
};

// One plain-English verb phrase per action. Keep this in sync with the
// ACTIONS list in app/activity/activity-log-list.tsx — that list is what
// the filter dropdown offers, this map is what each one reads as.
const ACTION_LABELS: Record<string, string> = {
  "user.registered": "signed up",
  "user.created": "added a new user",
  "user.approved": "approved a signup",
  "user.denied": "denied a signup",
  "user.edited": "updated a profile",
  "budget.allocated_funds_updated": "updated the budget",
  "budget.splitter_updated": "updated how the budget is split",
  "expense.created": "added an expense",
  "expense.edited": "updated an expense",
  "expense.deleted": "deleted an expense",
  "project.created": "created a project",
  "project.edited": "updated a project",
  "project.archived": "archived a project",
  "project.unarchived": "restored a project",
  "milestone.created": "added a milestone",
  "milestone.edited": "updated a milestone",
  "milestone.deleted": "deleted a milestone",
  "milestone.completed": "marked a milestone done",
  "milestone.reopened": "reopened a milestone",
  "milestone.reordered": "reordered milestones",
  "invoice.created": "created an invoice",
  "invoice.edited": "updated an invoice",
  "invoice.refreshed": "refreshed an invoice",
  "invoice.marked_paid": "marked an invoice paid",
  "invoice.marked_unpaid": "marked an invoice unpaid",
  "ar.created": "created a receipt",
  "ar.edited": "updated a receipt",
  "ar.refreshed": "refreshed a receipt",
  "settings.notification_days_updated": "updated the reminder timing",
  "settings.designated_payer_updated": "changed who receives payment",
};

export function actionLabel(action: string): string {
  const label = ACTION_LABELS[action];
  if (label) return label.charAt(0).toUpperCase() + label.slice(1);
  // Fallback for any action string not yet added above — still readable,
  // just not hand-written. Shouldn't happen in practice since every
  // logActivity() call site has an entry here, but a missing mapping
  // should degrade to something plain rather than crash.
  return action.replace(/[._]/g, " ");
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

// Plain-English name for a form field, used by the "fields:" detail
// formatters below (project/user/document edits, where several fields
// can change in one save and the log lists which ones). Keys here match
// the keys those routes' Object.keys(parsed.data) can actually produce —
// see lib/validation/projects.ts, lib/validation/auth.ts,
// lib/validation/documents.ts, and lib/documents/payer-fields.ts.
const FIELD_LABELS: Record<string, string> = {
  title: "title",
  billedToName: "billed to",
  billedToAttention: "attention",
  firstName: "first name",
  middleName: "middle name",
  lastName: "last name",
  suffix: "suffix",
  contactNumber: "contact number",
  description: "description",
  paymentMethod: "payment method",
  paymentAccountName: "payment account name",
  paymentBank: "payment bank",
  paymentAccountNumber: "payment account number",
  documentNumber: "document number",
  documentDate: "date",
  dueDate: "due date",
  agreementDate: "agreement date",
  totalProjectCost: "total project cost",
  amount: "amount",
  amountInWords: "amount in words",
  paymentPurpose: "payment purpose",
  remainingBalance: "remaining balance",
  receivedFromName: "received from",
  receivedFromAttention: "attention",
  receivedByName: "received by",
  receivedByTitle: "received by title",
  issuedBy: "issued by",
  signatureUrl: "signature",
  qrCodeUrl: "QR code",
  receivedBySignatureUrl: "signature",
  profilePicture: "profile picture",
  paymentQrCode: "payment QR code",
  paymentSignature: "payment signature",
};

function fieldList(fields: unknown): string | null {
  if (!Array.isArray(fields) || fields.length === 0) return null;
  return fields.map((f) => FIELD_LABELS[String(f)] ?? String(f)).join(", ");
}

function money(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : String(value);
}

// Per-action detail formatter. Each one knows its own action's detail
// shape (see the logActivity call sites in app/api/**) and renders only
// what a non-technical reader needs — a real value or a plain-word field
// list, never a raw object dump, a camelCase key, or a database ID.
// Actions not listed here (most of them) have nothing extra to show
// beyond the plain-English label above, and correctly render nothing.
const DETAIL_FORMATTERS: Record<string, (detail: Record<string, unknown>) => string | null> = {
  "project.created": (d) => (d.title ? String(d.title) : null),
  "project.edited": (d) => fieldList(d.fields),
  "project.archived": (d) => (d.title ? String(d.title) : null),
  "project.unarchived": (d) => (d.title ? String(d.title) : null),
  "milestone.created": (d) => (d.title ? String(d.title) : null),
  "milestone.edited": (d) => (d.title ? String(d.title) : null),
  "milestone.deleted": (d) => (d.title ? String(d.title) : null),
  "milestone.completed": (d) => (d.title ? String(d.title) : null),
  "milestone.reopened": (d) => (d.title ? String(d.title) : null),
  "invoice.created": (d) => (d.title ? String(d.title) : null),
  "invoice.edited": (d) => fieldList(d.fields),
  "invoice.refreshed": (d) => fieldList(d.fields),
  "invoice.marked_paid": (d) => (d.title ? String(d.title) : null),
  "invoice.marked_unpaid": (d) => (d.title ? String(d.title) : null),
  "ar.created": (d) => (d.title ? String(d.title) : null),
  "ar.edited": (d) => fieldList(d.fields),
  "ar.refreshed": (d) => fieldList(d.fields),
  "user.registered": (d) => (d.email ? String(d.email) : null),
  "user.created": (d) => (d.email ? String(d.email) : null),
  "user.approved": (d) => (d.email ? String(d.email) : null),
  "user.denied": (d) => (d.email ? String(d.email) : null),
  "user.edited": (d) => fieldList(d.fields),
  "expense.created": (d) =>
    d.amount ? `${money(d.amount)}${d.description ? ` for ${d.description}` : ""}` : null,
  "expense.edited": (d) =>
    d.previousAmount !== undefined && d.nextAmount !== undefined
      ? `${money(d.previousAmount)} to ${money(d.nextAmount)}`
      : null,
  "expense.deleted": (d) =>
    d.amount ? `${money(d.amount)}${d.description ? ` for ${d.description}` : ""}` : null,
  "budget.allocated_funds_updated": (d) =>
    d.previous !== undefined && d.next !== undefined
      ? `${money(d.previous)} to ${money(d.next)}`
      : null,
  "budget.splitter_updated": (d) =>
    typeof d.overrideCount === "number"
      ? `${d.overrideCount} custom ${d.overrideCount === 1 ? "share" : "shares"} set`
      : null,
  "settings.notification_days_updated": (d) =>
    d.previous !== undefined && d.next !== undefined ? `${d.previous} to ${d.next} days` : null,
  // designated_payer_updated's previous/next are user IDs, not names —
  // this formatter has no user lookup available, and a raw ID is worse
  // than nothing for a non-technical reader, so this deliberately shows
  // nothing extra. The plain-English label ("changed who receives
  // payment") already says what happened; who it's now set to is
  // visible on the Settings page itself.
  "settings.designated_payer_updated": () => null,
};

export function formatDetail(action: string, detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const formatter = DETAIL_FORMATTERS[action];
  if (!formatter) return null;
  return formatter(detail as Record<string, unknown>);
}
