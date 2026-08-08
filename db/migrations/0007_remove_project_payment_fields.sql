-- Removes the project-level payment columns (docs/phases-plan-revision-2.md
-- Phase 14). Payment info now lives in exactly one place — each user's own
-- payment profile (Phase 12), selected via the "Who receives payment"
-- designated-payer switch in Settings. POST /api/projects/[id]/documents
-- already preferred the designated payer's profile over these project
-- columns for every new invoice, so this data was only ever a fallback
-- for the case where no payer had been designated yet — dropping it
-- consolidates on a single source instead of keeping two.
--
-- projects.billed_to_name / billed_to_attention are untouched — Billed To
-- is about the client being billed, not who gets paid, and has no
-- equivalent on the user profile. project_documents' matching four
-- payment columns are also untouched — a generated document still
-- snapshots its own payment block at creation time.

ALTER TABLE "projects" DROP COLUMN "payment_method";
--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "payment_account_name";
--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "payment_bank";
--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "payment_account_number";
