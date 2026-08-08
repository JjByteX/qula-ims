-- Adds project-level billing defaults (docs/phases-plan-revision-1.md
-- Phase 8), so a project can carry its own billed-to and payment info
-- once instead of every invoice/AR retyping it. All nullable — existing
-- projects (including the seeded Bar and Kitchen project) keep working
-- with nothing set.

ALTER TABLE "projects" ADD COLUMN "billed_to_name" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "billed_to_attention" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "payment_method" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "payment_account_name" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "payment_bank" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "payment_account_number" text;
