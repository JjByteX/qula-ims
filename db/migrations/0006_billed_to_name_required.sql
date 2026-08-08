-- Makes projects.billed_to_name required (docs/phases-plan-revision-2.md
-- Phase 13). Every project has a client, so this was never really an
-- optional value, just an unenforced one. billed_to_attention stays
-- nullable — a specific contact person isn't always known up front and
-- has no sensible placeholder, unlike a company name.
--
-- Backfill first so this migration doesn't fail against any existing
-- project rows created before this column was required (Phase 8 shipped
-- it nullable). 'TBD' is a deliberate, visible placeholder — it should
-- get corrected on the next edit of that project, not silently blend in.

UPDATE "projects" SET "billed_to_name" = 'TBD' WHERE "billed_to_name" IS NULL;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "billed_to_name" SET NOT NULL;
