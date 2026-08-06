import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectDocuments, projects } from "@/db/schema";
import {
  arDocumentSchema,
  invoiceDocumentSchema,
  documentPrefillOverrideSchema,
} from "@/lib/validation/documents";
import { authorizeUser } from "@/lib/auth/authorize";

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

// Creates a generated invoice or AR (not an uploaded file — uploaded
// docs/PDFs use lib/storage's uploadProjectDocument via a separate flow).
// title/milestone/price are prefilled from the project (phases-plan 3.3)
// and used as-is unless the request includes its own value for one of
// them — in which case that override wins. This is what makes the
// prefill "editable before saving" rather than a hard, silent overwrite:
// the client (ProjectDocumentsSection) shows these three fields on the
// create form seeded from the project, and only sends a field here if
// the person changed it.
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

  const schema = body.type === "ar" ? arDocumentSchema : invoiceDocumentSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [created] = await db
    .insert(projectDocuments)
    .values({
      projectId,
      type: body.type,
      title: overrideParsed.data.title ?? project.title,
      milestone: overrideParsed.data.milestone ?? project.milestone,
      price: overrideParsed.data.price ?? project.price,
      ...parsed.data,
      createdByUserId: auth.user.id,
    })
    .returning();

  return NextResponse.json({ document: created });
}
