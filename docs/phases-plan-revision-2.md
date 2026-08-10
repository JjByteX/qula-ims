# Qula IMS, Revision 2 Phases Plan

Follow-up to docs/phases-plan-revision-1.md (Phases 8–12, all done). That
revision built project-level billing defaults, full auto-fill from a
milestone, real-user signatories, and a per-user payment profile with a
"who's currently getting paid" designated-payer switch in Settings.

This revision doesn't add new capability — it removes duplication that
revision 1 left behind and fixes one document-layout ordering issue.
Reading the code (ponytail discipline per docs/AGENTS.md: understand the
affected flow first, make the smallest safe change, don't touch anything
this doesn't need to touch) shows the designated-payer prefill in
`POST /api/projects/[id]/documents` already prefers the payer's own
profile over the project's billing-defaults columns for every payment
field. Those project-level payment columns are live, but for any project
using a designated payer — which is meant to be the normal case — they're
dead weight: fields a user can fill in on the Add Project form that get
silently overridden the moment a document is generated. That's the
"simplify" this plan is about: one source of truth for payment info (the
user profile, selected via the Settings radio), not two.

No inventory/stock work. No changes to Budget, Activity, or Dashboard.

## Phase 13, Required Billing Defaults, Reordered Under Project Title

### 13.1 Problem
Client point 1: billing defaults shouldn't be optional. Client point 2:
Billed To and Attention should sit under the project title, not buried in
a table row after the invoice's own meta block (Invoice No./Date/Due
Date).

Two different fields carry the "Billed To" name today, and this phase
only touches one of them:
- `projects.billedToName` / `billedToAttention` — the project-level
  default this phase makes required.
- `project_documents.billedToName` / `billedToAttention` — the
  per-document snapshot, unaffected. A document keeps whatever value it
  was created with, same snapshot rule as everywhere else in this
  system. This phase changes where that snapshot's value is *entered*
  (now required, at project creation) and where it's *displayed* (now
  under the document title), not the snapshot mechanism itself.

### 13.2 Schema
- `projects.billedToName` and `projects.billedToAttention` become
  `NOT NULL`. The other four Phase 8 columns
  (`paymentMethod`/`paymentAccountName`/`paymentBank`/
  `paymentAccountNumber`) are removed from `projects` entirely — see
  Phase 14, which is where that removal actually belongs (it's a
  dedup, not a "make required" change). Doing both in one phase would
  blur two different fixes into one migration; keeping them separate
  makes each migration a single, obviously-correct diff.
- Migration:
  ```sql
  -- Existing rows have NULL here (Phase 8 shipped these as optional).
  -- Backfill with a placeholder before adding the NOT NULL constraint,
  -- so the migration doesn't fail against real data — Attention has no
  -- sensible placeholder (a contact person can't be guessed), so it
  -- stays nullable; only billedToName becomes required, since a blank
  -- company name is the actual case worth preventing.
  UPDATE projects SET billed_to_name = 'TBD' WHERE billed_to_name IS NULL;
  ALTER TABLE projects ALTER COLUMN billed_to_name SET NOT NULL;
  ```
  `billedToAttention` stays nullable — "required" per the client's point
  is about Billed To (the actual client/company being billed); Attention
  (a specific contact person) is reasonably still optional, same as it
  is on the document schema today (`invoiceDocumentSchema` doesn't
  require it either).

### 13.3 Add/Edit Project form
- Move `billedToName` (required) and `billedToAttention` (still
  optional) out of the collapsible "Billing defaults" section and next
  to the "Project title" field, always visible — same visual tier as
  the title, not inside `<details>`. This directly answers point 2 for
  the *input* side: Billed To lives right under/beside the project
  title on the form, matching where it should appear on the generated
  document.
- `milestone.title`/`milestone.price` stay as they are today.
- Once Phase 14 removes the four payment columns from `projects`, the
  "Billing defaults" `<details>` section disappears from this form
  entirely — nothing optional is left to collapse. This phase can land
  first (making Billed To required + relocated) with the `<details>`
  section still holding the four payment fields temporarily, or land
  together with Phase 14 — either order is safe since they touch
  different columns; landing them in the same PR is simplest and avoids
  a form that briefly shows a required field next to a section about to
  be deleted.

### 13.4 API
- `projectSchema` (lib/validation/projects.ts): `billedToName` moves
  from `optionalTrimmed` to `z.string().trim().min(1, "Billed To is
  required")`. `billedToAttention` stays `optionalTrimmed`.
- `POST /api/projects` and `PATCH /api/projects/[id]` — no route code
  changes needed beyond the schema update; both already validate
  through `projectSchema`.

### 13.5 Document view layout
- `invoice-view.tsx` and `acknowledgement-receipt-view.tsx`: move the
  "Billed To" / "Received From" (+ Attention) block from its current
  spot (first row of the main table, after the meta block) to directly
  under `<h1 className={styles.title}>`, above `metaBlock`. Keep it as
  plain text lines (not a table row) — matching how a letterhead
  presents "To:" before an invoice number block, not as another line
  item alongside Amount Due.
- The main table's first row becomes "Project" (previously second),
  followed by Amount Due/Amount Received, Payment Purpose, etc. — same
  fields, same order relative to each other, just with Billed To/
  Received From promoted above the table instead of inside it.
- No schema or data changes for this — pure JSX reordering plus a small
  CSS addition (a `billedToBlock` class reusing `metaBlock`'s spacing
  but left-aligned) in `document.module.css`.

## Phase 14, Remove Project-Level Payment Fields (Dedup With User Profile)

### 14.1 Problem
Client point 4: Payment Method, Account Name, Bank, and Account Number
are already set up per-user in Settings/Profile (Phase 12), and whichever
user is selected as designated payer in Settings already prefills those
same four fields onto every new invoice
(`POST /api/projects/[id]/documents`, the `payerPaymentMethod` /
`payerPaymentAccountName` / `payerPaymentBank` /
`payerPaymentAccountNumber` block). Keeping a second copy of the same
four fields on the project form is exactly the duplication point 4
flags: two places to fill in the same info, with the project-level one
doing nothing once a payer is designated (the payer's profile always
wins per the existing `??` fallback order) and only matters in the
edge case where no payer has been designated yet.

Point 3 confirms the direction: the things that are really "per person"
(how they get paid) belong on the user-based settings switch, not
duplicated onto every project.

### 14.2 Schema
- Drop four columns from `projects`: `paymentMethod`,
  `paymentAccountName`, `paymentBank`, `paymentAccountNumber`.
- `projects.billedToName`/`billedToAttention` are untouched here — they
  stay (see Phase 13), since Billed To is about the client being billed,
  not who gets paid, and has no equivalent on the user profile.
- Migration:
  ```sql
  ALTER TABLE projects DROP COLUMN payment_method;
  ALTER TABLE projects DROP COLUMN payment_account_name;
  ALTER TABLE projects DROP COLUMN payment_bank;
  ALTER TABLE projects DROP COLUMN payment_account_number;
  ```
- `project_documents`' matching four columns are untouched — a generated
  document still snapshots its own payment block at creation time
  (still sourced from the designated payer, falling back to nothing if
  no payer is set — see 14.4), same as today.

### 14.3 Add/Edit Project form
- Remove the `paymentMethod`/`paymentAccountName`/`paymentBank`/
  `paymentAccountNumber` fields and, once Billed To/Attention have moved
  out per Phase 13.3, the whole "Billing defaults" `<details>` section
  and its `<summary>` — nothing optional is left to collapse.
- Net result: the Add Project form is title + Billed To (required) +
  Attention (optional) + first milestone (title + price). Four fewer
  inputs than today, and no `<details>` disclosure to open. This is the
  actual simplification point 4 is asking for — the same fields aren't
  asked for twice.
- Edit Project form: same removal.

### 14.4 API
- `projectSchema`: remove the four payment fields entirely (not just
  make them optional — they no longer exist on the entity).
- `POST /api/projects` / `PATCH /api/projects/[id]`: no route code
  changes beyond the schema update.
- `POST /api/projects/[id]/documents` (the Phase 9 prefill route):
  remove the `project.paymentMethod` / `project.paymentAccountName` /
  `project.paymentBank` / `project.paymentAccountNumber` fallback reads
  — `project` no longer has these fields. The designated payer's own
  profile becomes the only source:
  ```ts
  if (designatedPayer?.paymentMethod) autoFilled.paymentMethod = designatedPayer.paymentMethod;
  if (designatedPayer?.paymentAccountName) autoFilled.paymentAccountName = designatedPayer.paymentAccountName;
  if (designatedPayer?.paymentBank) autoFilled.paymentBank = designatedPayer.paymentBank;
  if (designatedPayer?.paymentAccountNumber) autoFilled.paymentAccountNumber = designatedPayer.paymentAccountNumber;
  ```
  When no payer is designated yet (`designatedPayer` is `undefined`),
  these four fields are simply left blank on the new document, same as
  they already are on a fresh project today before Phase 8 defaults
  were ever filled in — nothing regresses, since the project-level
  values were rarely the ones actually used once a payer existed
  anyway. The empty state is fixed by picking a designated payer in
  Settings (one action, already built), not by re-typing payment info
  per project.
- `billedToName`/`billedToAttention` auto-fill is unchanged — still
  reads from `project.billedToName`/`project.billedToAttention` (now
  required per Phase 13), unaffected by this phase.

### 14.5 Cleanup
- `app/projects/[id]/project-documents-section.tsx` (the dead-code
  milestone-picker "Add document" flow, per Phase 9.4's note that it's
  unreachable from the UI today): update its client-side prefill to
  match — drop the four `project.payment*` reads, keep
  `billedToName`/`billedToAttention`. Kept in sync for consistency in
  case it's revived, same reasoning Phase 9 already used for touching
  this file.
- `db/seed.ts`: remove the four payment fields from the seeded
  projects' billing defaults, keep `billedToName`/`billedToAttention`
  (now required, so seed data must set them).
- Search for any other read of `projects.paymentMethod` /
  `paymentAccountName` / `paymentBank` / `paymentAccountNumber` before
  landing this (`grep -rn "project\.payment" app lib`) — the documents
  route above is the only server-side reader found during planning, but
  confirm at implementation time in case something new landed since.

### 14.6 What doesn't change
- `users.paymentMethod`/`paymentAccountName`/`paymentBank`/
  `paymentAccountNumber`/`paymentQrCodeUrl`/`paymentSignatureUrl` —
  unchanged. This is already the correct place for these fields (Phase
  12.2, `app/users/[id]/edit/edit-profile-form.tsx`'s "Payment details"
  section) and is exactly what this phase consolidates onto.
- The Settings "Who receives payment" radio
  (`app/settings/designated-payer-card.tsx`) — unchanged. Already does
  what point 3 asks for: a user-based setting, picked once, that
  prefills the relevant fields everywhere a document needs them.
- `project_documents`' own payment columns and the snapshot rule —
  unchanged. A generated invoice still freezes its payment block at
  creation time; only the *source* of that block's auto-fill (payer
  profile only, no project-level fallback) changes.

## Phase 15, QR Code Snapshotted From Designated Payer, Manual Upload Removed

### 15.1 Problem
Phase 12.4 already snapshots the designated payer's `paymentSignatureUrl`
onto a new invoice's `signatureUrl` at creation time, but never did the
same for `paymentQrCodeUrl` — so a new invoice's `qrCodeUrl` stayed blank
even once a designated payer with a QR code existed, and the only way to
put a QR code on an invoice was a dedicated per-document "Upload QR code"
button (`document-toolbar.tsx`) hitting its own endpoint
(`POST .../documents/[documentId]/qr-code`). That button is real, working
upload UI, but it's redundant with the radio-selected payer's own profile
(Phase 12.2, `/users/[id]/edit`'s "Payment details" section) — exactly the
kind of duplicate-source-of-truth Phase 14 already removed for
method/account name/bank/account number, just left over for the QR image
specifically because auto-fill never got wired up for it.

### 15.2 Auto-fill wiring
- `POST /api/projects/[id]/documents`: alongside the existing
  `if (designatedPayer?.paymentSignatureUrl) autoFilled.signatureUrl = ...`
  line, add the matching one for the QR code:
  `if (designatedPayer?.paymentQrCodeUrl) autoFilled.qrCodeUrl = designatedPayer.paymentQrCodeUrl;`
  Same snapshot rule as everywhere else — copied once at creation, so a
  later payer change or profile edit never alters a document already
  generated.

### 15.3 Remove the redundant manual upload
- `document-toolbar.tsx`: remove the "Upload/Replace QR code" button, its
  file input, `handleQrCodeUpload`, and the `isUploading`/`uploadError`
  state — nothing else in that component depended on them.
- Delete `app/api/projects/[id]/documents/[documentId]/qr-code/route.ts`
  — its only caller was the button just removed.
- `lib/storage/upload.ts` / `lib/storage/index.ts`: remove
  `uploadInvoiceQrCode` — its only caller was the deleted route.
  `uploadPaymentQrCode` (the profile-level upload, Phase 12.2) is
  untouched and becomes the only place a QR code image is ever uploaded.

### 15.4 What doesn't change
- `project_documents.qrCodeUrl` — unchanged. A generated invoice still
  has its own snapshot column; this phase only changes how that column
  gets its value (auto-filled from the payer, not hand-uploaded per
  document) and removes the now-redundant manual path.
- `invoice-view.tsx`'s QR display — unchanged. Still shows
  `document.qrCodeUrl` if set, "No QR code uploaded yet." if not (can
  still happen with no designated payer, or a payer with no QR on file).
- AR documents — unaffected either way; the client's AR template never
  had a QR code field.

## Phase 16, Refresh: Re-Sync an Existing Document to the Current Payer

### 16.1 Problem
Payer info is snapshotted onto a document at creation time (by design —
Phase 12.4/14/15's whole point was that a later payer change or profile
edit shouldn't silently rewrite a document already sent). But that means
if the designated payer changes, or the same payer updates their payment
info/signature/QR code, after a document was generated, there was no way
to bring that existing document up to date short of manually retyping
every field to match — the one deliberate exception to "snapshot and
never touch again" this system needs.

Also found in the course of this: ARs never had any payer-linked
auto-fill at all. `receivedByName`/`receivedByTitle` came from a static
hardcoded default (`DOCUMENT_DEFAULTS`), not a live link to whoever's
actually designated, and there was no signature image field on ARs at
all — just a printed "Signature" line for a hand signature. Both invoice
and AR should work the same way here: the designated payer's info flows
onto new documents automatically, and can be re-synced onto existing ones
on demand.

### 16.2 Schema
- New column: `project_documents.receivedBySignatureUrl`, AR's
  equivalent of invoice's `signatureUrl` — same idea, separate column,
  since an AR and invoice for the same milestone are independent rows
  with independent snapshots.
- Migration:
  ```sql
  ALTER TABLE "project_documents" ADD COLUMN "received_by_signature_url" text;
  ```

### 16.3 Shared payer-fields helper
New file `lib/documents/payer-fields.ts`, extracted so document creation
and the new Refresh endpoint read the exact same "who's the payer and
what are their fields" logic instead of two copies that could drift:
- `getDesignatedPayer()` — the existing lookup (Settings >
  designatedPayerUserId > users row), moved here from inline in the
  create route.
- `getInvoicePayerFields(payer)` — payment method/account name/bank/
  account number/signature/QR/issuedBy, same logic Phase 14/15 already
  had inline in the create route, just extracted.
- `getArPayerFields(payer)` — new. `receivedByName`/`receivedByTitle`/
  `receivedBySignatureUrl` from the designated payer directly (their own
  name + "Project Lead", not `getIssuedByLine()`'s multi-user join,
  since an AR's "received by" is one specific signatory, not a list of
  everyone active).

### 16.4 Document creation now covers AR too
`POST /api/projects/[id]/documents`: the invoice branch now calls
`getInvoicePayerFields()` instead of the inline logic it had; a new AR
branch (previously nonexistent — ARs got no payer auto-fill at all)
calls `getArPayerFields()`. With no payer designated yet, both leave
their respective fields blank, same as before.

### 16.5 Refresh endpoint
New `POST /api/projects/[id]/documents/[documentId]/refresh`
(`.../[documentId]/refresh/route.ts`), same shape as the existing
mark-paid/mark-unpaid action endpoints:
- Looks up the document, 404s if missing.
- Re-fetches the *current* designated payer (not whatever was true at
  creation) and builds the same payer-fields object creation would use.
- Always sets `documentDate` to today, on both document types.
- `UPDATE`s the existing row in place — no new row, nothing deleted.
  What "delete the previous" meant in practice: the old payer info on
  that row gets overwritten, not a second document created and the
  first one removed.
- Logs `invoice.refreshed` / `ar.refreshed` activity, with the list of
  fields actually touched.
- Untouched: Billed To/Received From, amount, milestone, Payment
  Purpose, document number — none of these are payer-profile fields, so
  Refresh has no reason to reach them. Deliberately narrower than the
  general PATCH edit, which accepts whatever the request body sends;
  Refresh only ever touches its fixed, known field list.

### 16.6 UI
- `document-toolbar.tsx`: new "Refresh" button, same row as Back/Edit/
  Print (next to Edit, per how this was asked for), opens a confirmation
  dialog first — states in plain language what it's about to overwrite
  (the specific field list, type-dependent) before anything happens.
  Uses the existing `components/ui/dialog.tsx` (shadcn Dialog), already
  in the project and unused elsewhere for this purpose, rather than
  `window.confirm()` or a new dependency.
- `acknowledgement-receipt-view.tsx`: the payer's signature-block cell
  now renders `receivedBySignatureUrl` as an image above the printed
  signature line, when set — same `qrImage` sizing invoice's signature
  already uses. The client's side of the signature table is untouched;
  that signature is always in-person, never a stored image.

### 16.7 What doesn't change
- The snapshot rule everywhere else — Refresh is the one deliberate,
  explicit, confirmed exception; nothing else in the system silently
  re-syncs a document after creation.
- `document.qrCodeUrl` display, Billed To/Received From, amount,
  milestone, Payment Purpose — none of these are part of what Refresh
  touches.
- The general PATCH edit endpoint and `document-form.tsx` — still the
  place for hand-editing anything Refresh doesn't cover (or overriding
  what Refresh just set, same as always).

## Phase 17, Local Storage Fallback + .gitignore

### 17.1 Problem
`lib/storage/client.ts` threw at import time if any R2 env var was
missing — and since `app/api/users/[id]/route.ts` (and other routes)
import upload functions unconditionally, this broke *any* profile save,
not just ones that touched a file upload. Running the app locally
required a Cloudflare R2 account before anything as basic as editing a
profile's name would work. Separately, the repo had no `.gitignore` at
all, so nothing stopped `node_modules`, `.next`, or a real `.env` with
live secrets from being committed.

### 17.2 Local-disk storage driver
- New `lib/storage/local.ts`: `putObjectLocal`/`deleteFileLocal`/
  `getPublicUrlLocal`, writing to and serving from `public/uploads`
  (Next.js serves that directory's contents as static assets
  automatically, at a URL path matching the file's path on disk — no
  extra route needed).
- `lib/storage/client.ts`: replaced the unconditional throw with an
  exported `hasR2Config` boolean (all five R2 vars present, including
  `R2_PUBLIC_HOSTNAME`, previously checked separately only inside
  `getPublicUrl`). `r2Client` is only constructed when `hasR2Config` is
  true.
- `lib/storage/upload.ts`: `putObject`/`deleteFile`/`getPublicUrl`
  (the three internal seams every upload function already funneled
  through) branch on `hasR2Config` — R2 when configured, local disk
  otherwise. No new env var to set on purpose; the switch is automatic.
- Local disk is for local dev only — `public/uploads` isn't a real
  persistent object store on most hosts. R2 remains the only supported
  path for anything beyond that.

### 17.3 .gitignore
New `.gitignore`: `node_modules`, `.next`/`out` build output, all `.env*`
variants except `.env.example` (which stays tracked as the template),
`public/uploads/*` except a tracked `.gitkeep` (so the folder exists in a
fresh checkout without committing anyone's local test uploads),
`next-env.d.ts` (Next's own auto-regenerated file), and standard OS/
editor cruft.

### 17.4 What doesn't change
- Production/anything with real R2 credentials set — behavior is
  identical to before, just reached via the `hasR2Config` branch instead
  of unconditionally.
- Every upload function's own validation (file type, size limits) —
  unchanged; only where the bytes end up differs.

## Phase 18, Invoice/AR Only For Completed Milestones

### 18.1 Problem
The milestone menu let you create an invoice or AR for a milestone that
wasn't marked done yet — billing for work that isn't finished isn't a
real case this app needs to support, and the existing "No invoice or AR"
warning badge (shown when a milestone is completed but has no document)
already implies the intended order is complete, then document.

### 18.2 UI
`milestones-section.tsx`: the 3-dot menu's dropdown content is now
conditional on `milestone.status`. Completed shows the same two items as
before (Invoice, Acknowledgement Receipt). Not completed shows one item
instead, in the same position: "Mark as done to create invoice/AR" —
clicking it calls the existing `handleToggleComplete`, with
`event.preventDefault()` inside `onSelect` so the menu stays open through
the click instead of closing (Radix's default). Once the milestone's
status flips to completed, the same open dropdown re-renders showing the
real Invoice/AR items, no second click on the trigger needed. A milestone
already completed is completely unaffected — same two items, same
behavior as before this phase.

### 18.3 API
`POST /api/projects/[id]/documents`: added a `milestone.status !==
"completed"` check returning 400, since the create-document endpoint is
reachable by any authenticated client directly and shouldn't rely on the
UI alone to enforce this. Placed after the existing per-type-per-milestone
document lookup, not before — a milestone that was completed, had a
document made, and was later reopened should still return that existing
document (same "just open it" rule that check already follows) rather
than being blocked by the new one.

### 18.4 What doesn't change
- A completed milestone's dropdown, and the existing-document dedup
  behavior in `handleCreateDocument` — unaffected either way.
- The "No invoice or AR" warning badge — still fires the same way
  (completed, no document yet), still accurate since a milestone can
  still be marked done via the checkmark button directly without going
  through this dropdown.
- `project-documents-section.tsx`'s dead-code milestone picker — doesn't
  filter by status, but is protected by the same server-side guard as
  any other caller of the create-document endpoint.

## Phase 19, Activity Log In Plain English

### 19.1 Problem
The activity log was written for a technical reader, not the actual
audience. `actionLabel` derived its text by splitting the action string
and replacing underscores with spaces, which produced awkward results
for compound action names (`budget.allocated_funds_updated` -> "Budget
allocated funds updated"). `formatDetail` dumped the raw `detail` object
as `key: value` pairs joined by commas, showing camelCase field names
(`fields: paymentMethod,billedToName`), raw database IDs
(`milestoneId: 8f3a2c19-...`), and unformatted numbers straight from the
column. Each row also printed a second line with the raw `targetType`
string and a sliced UUID (`project · 8f3a2c19`), meaningless to a
non-technical reader and redundant with the row above it.

### 19.2 Rewrite
`lib/activity/format.ts`:
- `actionLabel`: replaced the string-split with an explicit
  `ACTION_LABELS` map, one hand-written plain-English verb phrase per
  action (e.g. "updated the budget", "changed who receives payment").
  Kept in sync with the `ACTIONS` filter list in
  `activity-log-list.tsx` — every action in that dropdown has an entry
  here (verified 30/30).
- `formatDetail`: now takes the action name too, and looks up a
  per-action formatter from `DETAIL_FORMATTERS` instead of dumping the
  raw object. Each formatter knows its own action's `detail` shape (from
  the actual `logActivity()` call sites in `app/api/**`) and renders
  only what's useful in plain words: a title, an email, a money amount
  formatted with commas, or a field list translated through
  `FIELD_LABELS` (`paymentAccountName` -> "payment account name"). A
  before/after value (budget amount, notification days, expense amount)
  reads as "50,000 to 75,000" instead of `previous: ..., next: ...`.
  Actions with nothing useful to add (`milestone.reordered`'s raw
  milestone ID list, `settings.designated_payer_updated`'s raw user IDs
  with no lookup available here) correctly show nothing extra — the
  plain-English label alone is already a complete sentence.
- Found and fixed along the way: `user.registered` was missing a detail
  formatter even though it logs the same `email` field `user.created`/
  `user.approved`/`user.denied` already showed.

### 19.3 UI
- `activity-log-list.tsx` / `recent-activity.tsx`: both already rendered
  `{actor} {actionLabel(...).toLowerCase()} — {detail}` as one sentence,
  so no rendering structure changed — just updated the `formatDetail`
  call to pass `entry.action` along with `entry.detail`.
- `activity-log-list.tsx`: removed the second line that printed raw
  `targetType` + a sliced document/project ID under each entry — with
  the detail formatters above now supplying the real subject (a title,
  a field list, an amount), that line was both unreadable and redundant.
- `activity-log-list.tsx`: added `invoice.refreshed`/`ar.refreshed` to
  the `ACTIONS` filter list — missing since Phase 16 added the Refresh
  action, found while cross-checking the list against the new label map.

### 19.4 What doesn't change
- `lib/activity/log.ts` and every `logActivity()` call site — the
  `detail` objects written to the database are unchanged; only how
  they're read back and displayed changed.
- The activity log's filters (actor/action/date range) and pagination —
  unaffected.

### 19.5 Fields list showing every field, every time
Once real data flowed through Phase 19's new field-list formatter, it
surfaced a problem that formatting alone couldn't fix: `project.edited`/
`user.edited`/`invoice.edited`/`ar.edited` all built their `fields` list
from `Object.keys(parsed.data)` — and since none of those three routes
use `schema.partial()`, `parsed.data` always contains every field the
schema defines, whether or not the person actually changed it in the
form. The result was a "fields" list that was really just the entire
form, every single save, no matter how small the real edit — e.g.
updating a profile always showed "first name, middle name, last name,
suffix, contact number, description, payment method, payment account
name, payment bank, payment account number" regardless of which single
field actually changed.

New `lib/activity/diff.ts`: `diffFields(before, after)` compares the row
as it was before the update against the values being written, and
returns only the keys that actually differ. Values are normalized first
(`undefined`/`null`/`""` all treated as the same "empty") so an unset
optional field doesn't register as a false change against another
equally-unset representation of the same nothing.

All three routes updated to use it:
- `app/api/projects/[id]/route.ts` — diffs `existing` (the pre-update
  row, already fetched) against `parsed.data`.
- `app/api/projects/[id]/documents/[documentId]/route.ts` — same, using
  `existing`.
- `app/api/users/[id]/route.ts` — diffs `target` against `parsed.data`
  for the text fields, plus three separate before/after comparisons for
  `profilePictureUrl`/`paymentQrCodeUrl`/`paymentSignatureUrl`, which
  are set from an uploaded file entirely outside `parsed.data` — without
  those three, a picture-only or signature-only save would diff to
  nothing and go unlogged even though something real changed.

All three now also skip calling `logActivity` entirely when the diff
comes back empty (a save where nothing actually changed) rather than
logging an "updated a profile" entry with nothing behind it — a no-op
save isn't a real event worth recording.

`invoice.refreshed`/`ar.refreshed` (Phase 16) were not part of this fix
— those intentionally touch a fixed, known set of fields every time by
design (that's what Refresh means), so listing the same fields on every
refresh is accurate, not noise, and there's no "before" values to diff
against in the same sense.

## Phase 20, Remove Notification Lead Time

### 20.1 Problem
The notification lead time setting (Settings > "Days before") let a
person type a number and save it, but that number had no visible effect
anywhere in the live app. Tracing every reference: its only consumer,
`isInvoiceDueSoon()` (`lib/documents/due-soon.ts`), was only ever called
from `app/projects/[id]/project-documents-section.tsx` — a component no
page imports or renders (the same dead-code file referenced throughout
Phase 9.4, 14.5, and 16). No cron job, scheduled task, or email digest
reads this value either — the app's only outgoing emails are
registration and password-reset. Changing this setting from 3 to 10 days
and saving produced a success message and genuinely nothing else.
Client-Requests.md's original ask ("Set the number of days before the
notification") was implemented as a settings field, but the actual
notification it was meant to configure was never built on top of it.

### 20.2 What was removed
- `db/schema/settings.ts`: dropped `notificationDaysBefore`. Migration
  0009 drops the column.
- `lib/documents/due-soon.ts`: deleted. `isInvoiceDueSoon()` was its only
  export and its only caller is gone too.
- `lib/validation/settings.ts`: removed `notificationSettingsSchema`
  and `NotificationSettingsInput`. `designatedPayerSchema` (a separate
  concern sharing the same file) is untouched.
- `app/settings/notification-settings-form.tsx`: deleted — the whole
  Settings card for this.
- `app/settings/page.tsx`: removed the import and render of that form,
  and updated the page's subtitle and comment, which described this
  setting as still current.
- `app/api/settings/route.ts`: removed the `PATCH` handler entirely
  (its only purpose was updating this setting) — `GET` is untouched,
  still shared by this route and the designated-payer card.
- `app/projects/[id]/project-documents-section.tsx`: removed the
  `isInvoiceDueSoon` import, the `notificationDaysBefore` prop, and the
  "Due soon" badge that depended on it — kept in sync per the same
  precedent this dead-code file has followed all session, even though
  nothing renders it.
- `lib/activity/format.ts` / `activity-log-list.tsx`: removed
  `settings.notification_days_updated` from `ACTION_LABELS` and the
  `ACTIONS` filter list (re-verified both lists still match exactly,
  29/29, same check as Phase 19).
- `db/seed.ts`: `seedAppSettings()` no longer seeds a value for the
  removed column; still ensures the single settings row exists.
- `lib/settings/get.ts`: fixed a comment that described the removed
  setting as current.

### 20.3 What doesn't change
- `designatedPayerUserId` and everything around it (Settings > "Who
  receives payment", Phase 12.3) — a completely separate setting on the
  same table, untouched.
- `app/api/settings/designated-payer/route.ts` — its own dedicated
  route, never touched this setting to begin with.

## Phase 21, Profile Edit Moves Into Settings

### 21.1 Problem
Settings only ever linked out to a separate page (`/users/[id]/edit`) to
edit your own profile — a click that landed on a page with just one
480px-wide card and a lot of empty margin around it. With the
notification lead time card gone (Phase 20), Settings itself was down to
one card too, looking sparse for what should be the app's main
preferences page.

### 21.2 What changed
- `app/settings/page.tsx`: rebuilt on the dashboard's own layout
  pattern — `max-w-[1600px]`, full viewport height, a Back button (fixed
  destination `/dashboard`, matching the invoice/AR toolbar's Back
  shape, since Settings only has the one real entry point). Two-column
  body: the payer card in a narrower 360px column, the profile edit form
  in the larger remaining width, same asymmetric-column spirit as the
  dashboard's Budget-gets-the-tall-column grid rather than an even
  50/50 split.
- `EditProfileForm` (`app/users/[id]/edit/edit-profile-form.tsx`): new
  optional `stayOnPage` prop. When true: the card drops its old
  `max-w-[480px]` (full width instead, since Settings' own column now
  controls the size), saving shows an inline "Profile saved." message
  and calls `router.refresh()` instead of navigating to the profile-view
  page, and the Cancel button is hidden (Settings' page-level Back
  covers that now). The prop defaults to false/undefined so the
  standalone page's behavior is unchanged when it's still used for that
  case (see below).
- `app/users/[id]/edit/page.tsx`: now redirects to `/settings` when the
  signed-in user is editing their own profile (`currentUser.id === id`),
  same redirect pattern this page already used for unauthorized access.
  What's left here is a superadmin editing someone else's profile — the
  form's `stayOnPage` prop is never passed on this route, so that flow
  is completely unchanged: same narrow card, same redirect-to-profile-
  view on save, same Cancel button.
- `app/users/[id]/page.tsx`: the Edit button now links to `/settings`
  when viewing your own profile, and to `/users/[id]/edit` as before
  when a superadmin is viewing someone else's.

### 21.3 What doesn't change
- `/users/[id]/edit` for a superadmin editing someone else — same page,
  same form, same narrow width, same behavior as before this phase.
- `app/api/users/[id]/route.ts` — the PATCH endpoint both flows submit
  to is untouched; only the two callers' post-save behavior differs via
  `stayOnPage`.
- The designated-payer card and its own route — unaffected, just
  relocated into the new two-column layout.

### 21.4 Picture/QR/signature: click the image itself, no separate button
All three image uploads (profile picture, payment QR code, payment
signature) used to pair the image/placeholder with a separate
label-styled button next to it ("Change picture" / "Upload QR code" /
"Upload signature") plus a hint line spelling out the accepted file
types and size limit. Replaced with a single click target: the image or
placeholder itself is the `<label>` (labels open their linked file
input natively, no extra JS needed), with a dark overlay and upload icon
that fades in on hover as the only affordance that it's clickable — no
separate button, no visible hint text. The hint text is dropped
entirely rather than hidden until hover; file pickers already surface
accepted types on their own, and the 2MB limit only matters in the rare
case someone exceeds it, which the existing inline error message still
covers when that happens. Each trigger keeps a `sr-only` accessible name
("Change profile picture" / "Upload QR code" / "Upload signature") so
the control still has a name for screen readers now that it has no
visible text.

## Out of Scope

- Multiple simultaneous designated payers, or a history of past payers
- Automated tests (still deferred, per the original phases-plan.md)
- Any change to Budget Splitter or Dashboard layout beyond Phase 19's
  activity-log wording fixes (Recent Activity uses the same formatters)
- Any change to the per-document edit form's payment fields
  (`document-form.tsx`) — a document can still be hand-edited after
  creation regardless of what auto-filled it, unchanged from Phase 9.3.
