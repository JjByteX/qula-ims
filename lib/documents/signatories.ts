import { getActiveUsers } from "@/lib/budget/compute";

// Live signatory line for new invoices (docs/phases-plan-revision-1.md
// Phase 11), replacing the hand-typed DOCUMENT_DEFAULTS.issuedBy string
// that didn't track the users table. Reuses getActiveUsers() from
// lib/budget/compute.ts rather than re-querying — same "active user"
// definition the budget splitter already uses, so this list and that one
// can't drift apart.
//
// The title suffix ("Project Lead") is a fixed string, not something
// read from a user's profile — what Phase 12 actually supplies is
// *whether* to append it: once a designated payer exists, the caller
// passes "Project Lead" through; until then, titleSuffix is left
// undefined and this falls back to no suffix, just the joined names.
//
// Existing documents are untouched by any of this — issuedBy is snapshot
// onto the document row at creation time (same rule as title/milestone/
// price), so this only affects documents created after a users-table
// change, never ones already generated.
export async function getIssuedByLine(titleSuffix?: string | null): Promise<string> {
  const activeUsers = await getActiveUsers();
  const names = activeUsers.map((u) => `${u.firstName} ${u.lastName}`.trim()).filter(Boolean);

  if (names.length === 0) {
    return titleSuffix?.trim() || "";
  }

  const joined = names.join(", ");
  const suffix = titleSuffix?.trim();
  return suffix ? `${joined}, ${suffix}` : joined;
}
