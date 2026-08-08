-- Removes app_settings.notification_days_before
-- (docs/phases-plan-revision-2.md Phase 20). Its only consumer,
-- lib/documents/due-soon.ts's isInvoiceDueSoon(), was only ever called
-- from app/projects/[id]/project-documents-section.tsx, a component no
-- page imports or renders — so changing this setting in Settings had no
-- visible effect anywhere in the live app. Removed rather than wired up,
-- since nothing in the current product actually needs a due-soon
-- notification concept.

ALTER TABLE "app_settings" DROP COLUMN "notification_days_before";
