import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { projectDocuments } from "@/db/schema";

// Auto-generates the next document number for a given type/year, e.g.
// "AR-2026-002", "INV-2026-014" — this used to be a field someone typed
// into the create form (documentNumber in lib/validation/documents.ts),
// but a receipt/invoice number should never depend on a person
// remembering the last one they used or guessing what's next. It's now
// derived here, server-side, at creation time only (never editable
// afterward — same "fixed once issued" rule the rest of a document's
// identity already follows).
//
// Sequence resets each calendar year (matches the existing "AR-2026-002"
// naming already in use) and counts *all* documents of this type across
// every project for that year, not just the current project's — matching
// how the two seeded documents (AR-2026-001, AR-2026-002) are numbered
// as one global sequence rather than per-project.
export async function generateDocumentNumber(type: "ar" | "invoice"): Promise<string> {
  const prefix = type === "ar" ? "AR" : "INV";
  const year = new Date().getFullYear();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.type, type),
        sql`extract(year from ${projectDocuments.documentDate}) = ${year}`,
      ),
    );

  const nextSequence = count + 1;
  const padded = String(nextSequence).padStart(3, "0");
  return `${prefix}-${year}-${padded}`;
}
