import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { milestones, projectDocuments, projects } from "@/db/schema";
import {
  arDocumentSchema,
  invoiceDocumentSchema,
  documentPrefillOverrideSchema,
} from "@/lib/validation/documents";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";
import { amountToWords } from "@/lib/documents/amount-to-words";
import { getDesignatedPayer, getInvoicePayerFields, getArPayerFields } from "@/lib/documents/payer-fields";
import { generateDocumentNumber } from "@/lib/documents/numbering";
import { computeArRemainingBalance } from "@/lib/documents/balance";

// Documents live on the project page (phases-plan 3.2), open to any
// signed-in user — same rule as the project itself.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const list = await db
    .select()
    .from(projectDocuments)
    .where(eq(projectDocuments.projectId, id))
    .orderBy(desc(projectDocuments.createdAt));

  return NextResponse.json({ documents: list });
}

// Creates a generated invoice or AR for one milestone (not an uploaded
// file — uploaded docs/PDFs use lib/storage's uploadProjectDocument via a
// separate flow). title/milestone/price are prefilled from the project +
// selected milestone (phases-plan 3.3) and used as-is unless the request
// includes its own value for one of them — in which case that override
// wins.
//
// The milestone's 3-dot menu creates the document immediately with just
// { type, milestoneId } — amount, amount in words, payment purpose, and
// (for invoices) the dates and payment/billed-to block are all derived
// server-side from the milestone and project below
// (phases-plan-revision-1.md Phase 9), rather than left blank, since the
// milestone and project already carry everything needed. Anything the
// request does send for these fields is used as-is instead of the
// derived value — same override-wins rule as title/milestone/price.
// Whatever's still missing after that (e.g. document number, or invoice
// fields when no project defaults are set) is filled in later on the
// document's own page (PATCH .../documents/[documentId], which does
// enforce the full arDocumentSchema/invoiceDocumentSchema before saving).
// So only the prefill fields are validated here; any generated-document
// fields included in the body are applied as-is, unvalidated, same as
// they'd end up blank if omitted.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id: projectId } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || (body.type !== "invoice" && body.type !== "ar")) {
    return NextResponse.json({ error: "Document type must be invoice or ar." }, { status: 400 });
  }

  const overrideParsed = documentPrefillOverrideSchema.safeParse(body);
  if (!overrideParsed.success) {
    const message = overrideParsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [milestone] = await db
    .select()
    .from(milestones)
    .where(eq(milestones.id, overrideParsed.data.milestoneId))
    .limit(1);
  if (!milestone || milestone.projectId !== projectId) {
    return NextResponse.json({ error: "Milestone not found on this project." }, { status: 404 });
  }

  // One document per type per milestone — the milestone menu is meant to
  // create-then-open, not create again on every click. Without this check,
  // clicking Invoice/AR on a milestone that already has one (e.g. a second
  // click before the client's own state caught up, or any other caller)
  // silently inserted a duplicate row instead of returning the existing one.
  const [existing] = await db
    .select()
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.milestoneId, milestone.id),
        eq(projectDocuments.type, body.type),
      ),
    )
    .limit(1);
  if (existing) {
    return NextResponse.json({ document: existing });
  }

  // An invoice or AR only makes sense for finished work
  // (docs/phases-plan-revision-2.md Phase 18) — the milestone menu's UI
  // already gates this (app/projects/[id]/milestones-section.tsx shows a
  // "mark as done" prompt instead of Invoice/AR for an incomplete
  // milestone), but this endpoint is reachable by any authenticated
  // client directly, so it needs its own check too rather than relying
  // on the UI alone. Checked after the existing-document lookup above,
  // not before: a milestone that was completed, had a document made,
  // and was later reopened should still return that existing document
  // (same "just open it" rule the check above already follows) instead
  // of being blocked by this one.
  if (milestone.status !== "completed") {
    return NextResponse.json(
      { error: "Mark this milestone as done before creating an invoice or AR." },
      { status: 400 },
    );
  }

  const schema = body.type === "ar" ? arDocumentSchema : invoiceDocumentSchema;
  const fieldsParsed = schema.partial().safeParse(body);
  if (!fieldsParsed.success) {
    const message = fieldsParsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Full auto-fill from the milestone/project (phases-plan-revision-1.md
  // Phase 9). fieldsParsed.data only has keys the request actually sent
  // (schema.partial()), so anything the milestone/project already knows
  // and the request left out is derived here instead of staying blank.
  // Spread order below (autoFilled first, then fieldsParsed.data) means
  // an explicit value in the request always wins over the derived one —
  // same "override wins" rule the title/milestone/price prefill already
  // follows just above.
  const todayIso = new Date().toISOString().slice(0, 10);
  const autoFilled: Record<string, string> = {
    amount: milestone.price,
    amountInWords: amountToWords(milestone.price),
    paymentPurpose: milestone.title,
    documentDate: todayIso,
  };

  const designatedPayer = await getDesignatedPayer();

  if (body.type === "invoice") {
    // Invoice No. (lib/documents/numbering.ts) — mirrors the AR branch's
    // own generateDocumentNumber("ar") call below. This was previously
    // missing here, so every invoice created through this route (as
    // opposed to the db/seed.ts script, which hardcodes its own
    // INV-2026-00N values) saved with a blank documentNumber instead of
    // the next one in sequence.
    autoFilled.documentNumber = await generateDocumentNumber("invoice");
    autoFilled.dueDate = todayIso;
    autoFilled.agreementDate = todayIso;

    // billedToName/billedToAttention are always about the client being
    // billed, not who's paid, so these stay sourced from the project's
    // Phase 8 defaults regardless of whether a designated payer exists.
    // billedToName is mandatory on every project (db/schema/projects.ts
    // .notNull(), enforced at the form too by projectSchema), so this is
    // never actually conditional — only billedToAttention can be unset.
    autoFilled.billedToName = project.billedToName;
    if (project.billedToAttention) autoFilled.billedToAttention = project.billedToAttention;

    // Payment block + signatory (docs/phases-plan-revision-2.md Phase
    // 14/15/16): the designated payer's own profile is the only source
    // for these fields now — see lib/documents/payer-fields.ts for the
    // full reasoning, shared with the AR branch below and with the
    // Refresh action (.../[documentId]/refresh/route.ts).
    Object.assign(autoFilled, await getInvoicePayerFields(designatedPayer));

    const [{ totalProjectCost }] = await db
      .select({ totalProjectCost: sql<string>`coalesce(sum(${milestones.price}), 0)` })
      .from(milestones)
      .where(eq(milestones.projectId, projectId));
    autoFilled.totalProjectCost = totalProjectCost;
  } else {
    // Received From / Attention — same client info as invoice's
    // billedToName/billedToAttention above, just under the AR's own
    // field names. This was previously missing here, so every AR
    // created through this route saved with a blank "Received From"
    // row instead of the project's billed-to client (see the invoice
    // branch above and db/seed.ts's seedFnbProject, which both already
    // treat billedToName/billedToAttention as the one source for who
    // the client being billed/received-from is). billedToName is
    // mandatory on every project, same as the invoice branch above, so
    // this is unconditional too — only receivedFromAttention can be unset.
    autoFilled.receivedFromName = project.billedToName;
    if (project.billedToAttention) autoFilled.receivedFromAttention = project.billedToAttention;

    // AR payer-linked fields (docs/phases-plan-revision-2.md Phase 16):
    // receivedByName/receivedByTitle/receivedBySignatureUrl now come
    // from the designated payer, same live link invoices already had —
    // previously these had no auto-fill at all here (DOCUMENT_DEFAULTS'
    // static name was only ever used by the client-side dead-code path
    // in project-documents-section.tsx, never server-side). With no
    // payer designated yet, these are simply left blank, same as any
    // other field nothing has filled in yet.
    Object.assign(autoFilled, getArPayerFields(designatedPayer));

    // Receipt No. and Remaining Balance are always generated/derived for
    // an AR, never taken from the request — same "override wins" spread
    // order below would otherwise let a caller supply its own value for
    // either, which defeats the point of auto-generating them. These are
    // deliberately applied to autoFilled (not appended after
    // fieldsParsed.data) and fieldsParsed.data can no longer contain
    // these keys anyway since arDocumentSchema.partial() no longer
    // includes documentNumber/remainingBalance
    // (lib/validation/documents.ts).
    autoFilled.documentNumber = await generateDocumentNumber("ar");
    autoFilled.remainingBalance = await computeArRemainingBalance(projectId, milestone.id);
  }

  const [created] = await db
    .insert(projectDocuments)
    .values({
      projectId,
      milestoneId: milestone.id,
      type: body.type,
      title: overrideParsed.data.title ?? project.title,
      milestone: overrideParsed.data.milestone ?? milestone.title,
      price: overrideParsed.data.price ?? milestone.price,
      ...autoFilled,
      ...fieldsParsed.data,
      createdByUserId: auth.user.id,
    })
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: created.type === "ar" ? "ar.created" : "invoice.created",
    targetType: "document",
    targetId: created.id,
    detail: { projectId, milestoneId: milestone.id, title: created.title },
  });

  // An AR is the confirmation that payment was received (Client-
  // Requests.md — "it will be paid once the acknowledgement receipt is
  // made"), so creating one auto-marks this milestone's invoice as paid
  // instead of relying on someone to separately toggle it. This replaces
  // the old manual "Mark as paid" button on the invoice toolbar — see
  // app/projects/[id]/documents/[documentId]/document-toolbar.tsx.
  // mark-paid/route.ts's own idempotent-if-already-paid check isn't
  // needed here since this only ever runs once per AR (the existing-
  // document short-circuit above prevents a second AR for the same
  // milestone), but the same "only invoices, only if not already paid"
  // guard still applies in case no invoice was ever generated for this
  // milestone.
  if (created.type === "ar") {
    const [invoice] = await db
      .select()
      .from(projectDocuments)
      .where(
        and(eq(projectDocuments.milestoneId, milestone.id), eq(projectDocuments.type, "invoice")),
      )
      .limit(1);

    if (invoice && !invoice.isPaid) {
      await db
        .update(projectDocuments)
        .set({ isPaid: true, updatedAt: new Date() })
        .where(eq(projectDocuments.id, invoice.id));

      await logActivity({
        actorUserId: auth.user.id,
        action: "invoice.marked_paid",
        targetType: "document",
        targetId: invoice.id,
        detail: { projectId, title: invoice.title, reason: "ar_created" },
      });
    }
  }

  return NextResponse.json({ document: created });
}
