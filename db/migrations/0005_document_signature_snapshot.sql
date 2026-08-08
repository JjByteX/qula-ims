-- Adds the invoice signature snapshot column
-- (docs/phases-plan-revision-1.md Phase 12.4). Set once at creation from
-- the designated payer's paymentSignatureUrl, alongside issuedBy — never
-- live-linked, so a later payer change or profile edit can't alter a
-- document that already went out.

ALTER TABLE "project_documents" ADD COLUMN "signature_url" text;
