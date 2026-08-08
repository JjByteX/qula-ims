-- Drops the payment reference note field from project_documents
-- (docs/phases-plan-revision-1.md Phase 10). The client no longer wants
-- this field on invoices/AR documents.

ALTER TABLE "project_documents" DROP COLUMN "payment_reference_note";
