import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { milestones, projectDocuments, projects } from "@/db/schema";
import {
  arDocumentSchema,
  invoiceDocumentSchema,
  documentPrefillOverrideSchema,
} from "@/lib/validation/documents";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

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
// { type, milestoneId } — the rest of the fields (invoice/AR number,
// amounts, etc.) are blank at creation and filled in later on the
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

  const schema = body.type === "ar" ? arDocumentSchema : invoiceDocumentSchema;
  const fieldsParsed = schema.partial().safeParse(body);
  if (!fieldsParsed.success) {
    const message = fieldsParsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
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

  return NextResponse.json({ document: created });
}
