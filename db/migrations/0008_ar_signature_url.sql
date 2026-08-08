-- Adds project_documents.received_by_signature_url
-- (docs/phases-plan-revision-2.md Phase 16). ARs previously had no
-- signature image field at all — just a text "Signature" line, no <img>,
-- unlike invoices which already snapshot signature_url. This gives ARs
-- the same snapshot column so the designated payer's actual signature
-- image can appear on a generated AR, same as it already does on
-- invoices. Nullable, like signature_url — an AR generated before a
-- payer had a signature on file just shows the blank line, same as
-- always.

ALTER TABLE "project_documents" ADD COLUMN "received_by_signature_url" text;
