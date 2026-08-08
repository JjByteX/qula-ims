import { NextResponse } from "next/server";
import { getOrCreateAppSettings } from "@/lib/settings/get";
import { authorizeUser } from "@/lib/auth/authorize";

// View is open to any signed-in user, same reasoning as
// app/api/budget/route.ts — Client-Requests.md draws no view/edit
// distinction here either.
//
// No PATCH here anymore — this route used to also update the
// notification lead time (docs/phases-plan-revision-2.md Phase 20
// removed that setting entirely, since its only effect,
// isInvoiceDueSoon(), was only ever called from a component no page
// renders). Updating the designated payer has its own dedicated route,
// app/api/settings/designated-payer/route.ts.
export async function GET() {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const current = await getOrCreateAppSettings();
  return NextResponse.json({ settings: current });
}
