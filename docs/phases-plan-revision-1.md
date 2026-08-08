# Qula IMS, Revision 1 Phases Plan

Follow-up to docs/phases-plan.md. Scope is the client's three change requests
against the already-built Projects, Invoice/AR, and Settings modules:
connect Projects to Invoice/AR defaults, auto-generate more of each
document from its milestone, remove the reference note field, replace the
hardcoded signatory line with real users, and add a per-user payment
profile with a "who's currently getting paid" switch in Settings that
never rewrites documents already generated.

No inventory/stock work. No changes to Budget, Activity, or Dashboard
beyond what naturally follows from schema changes here (e.g. an activity
log entry for a new mutation).

## Phase 8, Project-Level Billing Defaults — done

### 8.1 Schema
- Add billing default columns to `projects`: `billedToName`,
  `billedToAttention`, `paymentMethod`, `paymentAccountName`,
  `paymentBank`, `paymentAccountNumber` — same shape as the matching
  columns already on `project_documents`, so a value copies straight
  across with no reshaping.
- All nullable — existing projects (and the seeded Bar and Kitchen
  project) keep working with nothing set.
- Write the migration by hand (matching the 0001 migration's style) and
  regenerate the drizzle snapshot/journal entry.

### 8.2 Add/Edit Project form
- Add the six fields above to the "Add project" form as an optional,
  collapsible "Billing defaults" section — the project title + first
  milestone stay the required, always-visible fields so creating a
  project with no billing info yet is still one field.
- Same section on the project's edit form.
- These are the project's own defaults, not a specific document's
  values — editing them later never touches documents already generated
  (same "snapshot, not live reference" rule the milestone title/price
  already follow for documents).

### 8.3 API
- Extend `projectSchema` (lib/validation/projects.ts) with the six
  optional fields.
- `POST /api/projects` and `PATCH /api/projects/[id]` accept and store
  them.
- Log activity on change, consistent with existing project mutations.

## Phase 9, Full Auto-Fill From Milestone — done

### 9.1 Problem
Creating a document from the milestone's 3-dot menu
(`handleCreateDocument` in app/projects/[id]/milestones-section.tsx)
currently POSTs only `{ type, milestoneId }`. `title`/`milestone`/`price`
prefill server-side, but `amount`, `amountInWords`, `paymentPurpose`,
`documentDate`, and (for invoices) `billedToName`/`billedToAttention`/
payment-block fields are left blank even though the milestone and (after
Phase 8) the project already have everything needed to fill them.

### 9.2 Server-side prefill
- In `POST /api/projects/[id]/documents` (app/api/projects/[id]/documents/route.ts),
  when a field isn't included in the request body, derive it instead of
  leaving it null:
  - `amount` ← milestone.price
  - `amountInWords` ← number-to-words conversion of milestone.price
  - `paymentPurpose` ← milestone.title
  - `documentDate` ← today
  - `dueDate` (invoice only) ← today + notification lead time, or left
    blank if that reads as an odd default — confirm with the "Amount
    Due" wording, since due date is a real commitment date, not just a
    convenience field. Simplest correct default: today, editable
    immediately after.
  - Invoice-only payment block (`billedToName`, `billedToAttention`,
    `paymentMethod`, `paymentAccountName`, `paymentBank`,
    `paymentAccountNumber`) ← the project's Phase 8 billing defaults,
    when the project has them set.
  - `totalProjectCost` (invoice only) ← sum of the project's milestone
    prices.
  - `issuedBy` (invoice only) ← Phase 11's live signatory line.
- This applies to both creation paths: the milestone menu's
  create-then-open flow, and the "Add document" flow on
  project-documents-section.tsx that already shows prefilled fields
  before submit — the latter already resolves these client-side into the
  form defaults; this phase makes the server resolve them too so neither
  path can end up with blanks.
- A number-to-words helper is new — add `lib/documents/amount-to-words.ts`
  (integer peso amounts, "Pesos Only" suffix, matching the seed data's
  wording exactly).

### 9.3 Editable after prefill
- None of this changes editability — every prefilled value is still a
  normal field on the document's edit page, exactly as today. Auto-fill
  only removes the retyping step; it doesn't lock anything.

### 9.4 Implementation notes
- `dueDate` and `agreementDate` both default to today, per 9.2's resolved
  default — editable immediately after, same as everything else here.
- `issuedBy` still comes from `DOCUMENT_DEFAULTS.issuedBy` (unchanged) —
  Phase 11 is what replaces that source with the live signatory line;
  this phase only wires the auto-fill plumbing around it.
- `app/projects/[id]/project-documents-section.tsx` (the milestone-picker
  "Add document" flow) turned out to be dead code — superseded by the
  milestone 3-dot menu per its own comment — so it isn't reachable from
  the UI today. Updated anyway for consistency in case it's revived, but
  the auto-fill that actually matters for daily use is the server-side
  version in `POST /api/projects/[id]/documents`, which the live
  milestone-menu flow calls.
- `totalProjectCost` on invoices is now the true sum of all of a
  project's milestone prices (both server-side and in the dead-code
  client prefill above), not just the current milestone's price — this
  was already slightly wrong before Phase 9 and got fixed as part of
  wiring up the same total-project-cost auto-fill.

## Phase 10, Remove Payment Reference Note

### 10.1 Schema
- Drop `payment_reference_note` from `project_documents`.
- Migration: `ALTER TABLE project_documents DROP COLUMN payment_reference_note;`

### 10.2 Code removal
Remove every reference:
- `db/schema/projects.ts` — column definition
- `lib/validation/documents.ts` — `paymentReferenceNote` in
  `invoiceDocumentSchema`
- `app/projects/[id]/documents/[documentId]/document-form.tsx` — the
  "Reference/Note to include" field
- `app/projects/[id]/documents/[documentId]/edit/edit-document-form.tsx` —
  `toDefaultValues`
- `app/projects/[id]/documents/[documentId]/invoice-view.tsx` — the
  "Reference/Note to include" table row
- `app/projects/[id]/project-documents-section.tsx` — `emptyInvoiceDefaults`
- `db/seed.ts` — seeded document values

## Phase 11, Signatories Derived From Real Users

### 11.1 Problem
`lib/documents/defaults.ts`'s `issuedBy` is a hand-typed string
("Ejay Gonzales Eduardo II, Jj Sanchez Bassig, Rasty Cannu Espartero,
Project Lead") that doesn't track the `users` table. Ejay isn't a real
account in `db/seed.ts` (only JJ and Rasty are), and adding or removing a
teammate today means editing this string by hand instead of the system
picking it up automatically.

### 11.2 Live signatory line
- Add `lib/documents/signatories.ts`: `getIssuedByLine()` queries active
  users (reusing `getActiveUsers()` from lib/budget/compute.ts, or a
  copy scoped to this module if pulling in budget code is undesirable)
  and joins their full names, comma-separated, ending in a fixed title
  suffix ("Project Lead") pulled from Phase 12's designated payer profile
  once that exists — falls back to no suffix if nobody is designated
  yet.
- Used by Phase 9's server-side prefill for new invoices.
- Existing documents keep whatever `issuedBy` string they were created
  with — this only governs new documents, same snapshot rule as
  title/milestone/price.

### 11.3 Cleanup
- Remove the hardcoded `issuedBy` line from `lib/documents/defaults.ts`
  and `db/seed.ts`; seed data instead reflects the two real seeded users
  (JJ, Rasty) — no "Ejay" anywhere in the codebase.
- `issuedBy` stays an editable field on the document form (per-document
  override still allowed, e.g. wording differs for one particular
  invoice).

## Phase 12, Per-User Payment Profile + Designated Payer

### 12.1 Schema
- Add payment profile columns to `users`: `paymentQrCodeUrl`,
  `paymentMethod`, `paymentAccountName`, `paymentBank`,
  `paymentAccountNumber`, `paymentSignatureUrl`. All nullable — a user
  with none of these set just has an incomplete payment profile, not an
  error.
- Add one designated-payer pointer, stored as a single-row setting
  rather than a column on `users` (consistent with `app_settings`'
  existing single-row pattern): `app_settings.designated_payer_user_id`,
  nullable, `references users(id)`.
- Migration adds both the new `users` columns and the new
  `app_settings` column in one file.

### 12.2 Profile fields (edit form)
- Extend `app/users/[id]/edit/edit-profile-form.tsx` with a "Payment
  details" section: Method, Account Name, Bank, Account Number as text
  inputs; QR code and Signature as image uploads, same
  pick-file-then-preview pattern already used for the profile picture.
- Same self-or-superadmin edit rule as the rest of the profile (no new
  permission concept needed).
- `PATCH /api/users/[id]` accepts the new fields and two new optional
  files (`paymentQrCode`, `paymentSignature`) in the existing
  multipart form submission; validated and stored the same way
  `profilePicture` already is, via two new `lib/storage/upload.ts`
  functions (`uploadPaymentQrCode`, `uploadPaymentSignature`) that
  mirror `uploadInvoiceQrCode`'s 2MB/image-type rules.

### 12.3 Settings: designated payer
- New card on the Settings page, "Who receives payment" — a radio
  button per active user (reusing `getActiveUsers()`), showing each
  user's name and whether their payment profile is complete. Selecting
  one calls `PATCH /api/settings` (extended) or a new
  `PATCH /api/settings/designated-payer` route, which sets
  `app_settings.designated_payer_user_id`.
- No built-in radio-group primitive exists in components/ui and no
  Radix radio-group package is installed — build a small native
  `<input type="radio">`-based `RadioGroup`/`RadioGroupItem` pair in
  components/ui, styled consistently with the existing checkbox.tsx
  (same CSS variables, focus ring, checked-state fill), rather than
  adding a new dependency.
- Changing the designated payer never touches documents already
  generated — this only affects what Phase 9's server-side prefill (for
  `paymentMethod`/`paymentAccountName`/`paymentBank`/
  `paymentAccountNumber`/QR/signature on new invoices) reads going
  forward. This is the same snapshot principle used everywhere else in
  the document system, just applied to the payer's own info instead of
  the milestone's.

### 12.4 Prefill wiring
- Phase 9's invoice auto-fill, once a designated payer exists, prefers
  the designated payer's own `paymentMethod`/`paymentAccountName`/
  `paymentBank`/`paymentAccountNumber`/`paymentQrCodeUrl` over the
  project's Phase 8 defaults for those specific fields — the project
  defaults remain the fallback when no payer is designated yet, and stay
  the source for `billedToName`/`billedToAttention` either way (those
  are about the client being billed, not who's paid).
- `issuedBy` (Phase 11) also reflects the designated payer's title
  suffix once one exists.
- Signature image: add a signature block to the invoice view
  (`invoice-view.tsx`) below "Issued By", showing the designated payer's
  `paymentSignatureUrl` at generation time — also snapshotted onto the
  document row (`signatureUrl` column on `project_documents`, set once
  at creation) so a later payer change or profile edit can't alter a
  document that already went out.

## Out of Scope

- Multiple simultaneous designated payers, or a history of past payers
- Automated tests (still deferred, per the original phases-plan.md)
- Any change to Budget Splitter, Activity Log viewer, or Dashboard layout
